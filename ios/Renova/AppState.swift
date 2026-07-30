/// One piece of orchestration state for the whole app, mirroring App.tsx.
import CoreGraphics
import Foundation
import SwiftUI
import UIKit

@MainActor
final class AppState: ObservableObject {
  enum ModelStatus: Equatable {
    case absent
    /// This device cannot hold the model at all. Never offered the download.
    case tooSmall
    case downloading(Double)
    case warming
    case ready
    case failed(String)
  }

  enum Screen: Equatable {
    case landing, capture, working, result
  }

  @Published var screen: Screen = .landing
  @Published var modelStatus: ModelStatus = .absent
  @Published var language: Language = .en
  @Published var stageMessage: String = ""
  @Published var result: PipelineResult?
  @Published var errorMessage: String?

  /// nil only when the bundled engine failed to load, which is a build defect;
  /// the UI shows a hard error rather than pretending to work.
  let rules: RulesEngine?
  let rulesLoadError: String?
  let gemma = GemmaService()
  let speech = Speech()

  init() {
    do {
      rules = try RulesEngine()
      rulesLoadError = nil
    } catch {
      rules = nil
      rulesLoadError = error.localizedDescription
    }
    if GemmaService.modelOnDisk(), GemmaService.deviceCanHoldModel {
      modelStatus = .warming
      Task { await warm() }
    } else if !GemmaService.deviceCanHoldModel {
      modelStatus = .tooSmall
    }
  }

  func startDownload() {
    guard GemmaService.deviceCanHoldModel else {
      modelStatus = .tooSmall
      return
    }
    modelStatus = .downloading(0)
    Task {
      do {
        try await GemmaService.download { [weak self] fraction in
          self?.modelStatus = .downloading(fraction)
        }
        await warm()
      } catch {
        modelStatus = .failed(error.localizedDescription)
      }
    }
  }

  private func warm() async {
    modelStatus = .warming
    do {
      try await gemma.warm()
      modelStatus = .ready
    } catch {
      // A failed warm must not look like a design choice. Say it, and the
      // deterministic path keeps working.
      modelStatus = .failed(error.localizedDescription)
    }
  }

  func run(images: [CGImage], demoScenarioId: String? = nil) {
    guard let rules else { return }
    errorMessage = nil
    screen = .working
    Task {
      do {
        var cached: (en: String, es: String)?
        if let demoScenarioId, await !gemma.isReady {
          cached = try await rules.demoProse(id: demoScenarioId)
        }
        let out = try await Pipeline.analyse(
          images: images,
          rules: rules,
          gemma: gemma,
          language: language,
          cachedProse: cached,
          onStage: { [weak self] stage in self?.stageMessage = stage.rawValue }
        )
        result = out
        screen = .result
      } catch {
        errorMessage =
          "We could not read those photos. Try again with more light, or with one page at a time."
        screen = .capture
      }
    }
  }

  func runDemo(_ scenario: DemoScenario) {
    var images: [CGImage] = []
    for name in scenario.images {
      guard let ui = UIImage(named: name), let cg = ui.cgImage else {
        errorMessage = "The sample packet could not be loaded."
        return
      }
      images.append(cg)
    }
    run(images: images, demoScenarioId: scenario.id)
  }

  /// Re-render the current result in the other language. The bridge call is
  /// cheap and re-derives the language-dependent strings.
  func switchLanguage(to next: Language) {
    speech.stop()
    language = next
    guard let rules, let current = result else { return }
    Task {
      // Re-decorating requires a bridge round trip; reuse attachProse with the
      // prose already on the analysis so the check-suite and banner strings
      // re-render in the requested language.
      let payload = current.analysis.payload
      if payload.explanationEn.isEmpty && payload.explanationEs.isEmpty { return }
      if let redone = try? await rules.attachProse(
        to: current.analysis,
        en: payload.explanationEn,
        es: payload.explanationEs,
        fromCache: payload.proseFromCache,
        language: next)
      {
        result = PipelineResult(
          analysis: redone, modelRan: current.modelRan, modelError: current.modelError)
      }
    }
  }
}

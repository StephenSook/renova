/// Photograph to checklist, on one device. Native mirror of src/pipeline.ts.
///
/// The order is fixed and the ownership is fixed with it: OCR reads the
/// pixels, the rules engine (in JavaScriptCore, verbatim) owns the three
/// safety fields, and only then does Gemma see anything, and only to write
/// prose. A model failure of any kind delivers the deterministic answer.
import CoreGraphics
import Foundation

enum Stage: String {
  case reading = "Reading your document..."
  case extracting = "Finding your deadline..."
  case explaining = "Putting it in plain words..."
  case done = "Done."
}

struct PipelineResult {
  var analysis: Analysis
  var modelRan: Bool
  var modelError: String?
}

enum Pipeline {
  static func analyse(
    images: [CGImage],
    rules: RulesEngine,
    gemma: GemmaService?,
    language: Language,
    cachedProse: (en: String, es: String)? = nil,
    onStage: @MainActor @escaping (Stage) -> Void
  ) async throws -> PipelineResult {
    await MainActor.run { onStage(.reading) }
    var pages: [String] = []
    for image in images {
      pages.append(try await OcrService.text(from: image))
    }

    await MainActor.run { onStage(.extracting) }
    var analysis = try await rules.analyze(pages: pages, language: language)
    var result = PipelineResult(analysis: analysis, modelRan: false, modelError: nil)

    if let gemma, await gemma.isReady {
      await MainActor.run { onStage(.explaining) }
      do {
        let system = try await rules.systemPrompt()
        let promptEn = try await rules.prompt(for: analysis, pages: pages, language: .en)
        let en = try await gemma.generate(system: system, prompt: promptEn)
          .trimmingCharacters(in: .whitespacesAndNewlines)
        let promptEs = try await rules.prompt(for: analysis, pages: pages, language: .es)
        let es = try await gemma.generate(system: system, prompt: promptEs)
          .trimmingCharacters(in: .whitespacesAndNewlines)

        // The full check-suite runs in the bridge: cross-check both languages,
        // glossary enforcement, Spanish-intactness, refused-field guard.
        analysis = try await rules.attachProse(
          to: analysis, en: en, es: es, fromCache: false, language: language)
        result = PipelineResult(analysis: analysis, modelRan: true, modelError: nil)
      } catch {
        // The deterministic result is already complete and is returned as it
        // stands. The UI says the explanation could not be produced.
        result.modelError = error.localizedDescription
      }
    } else if let cachedProse {
      // Demo path with no model on the device: the saved answer this same
      // engine produced for these exact pages, labelled as saved on screen,
      // and re-checked against the fields just read.
      analysis = try await rules.attachProse(
        to: analysis, en: cachedProse.en, es: cachedProse.es, fromCache: true, language: language)
      result.analysis = analysis
    }

    await MainActor.run { onStage(.done) }
    return result
  }
}

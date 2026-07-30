/// Reading pixels into text, natively.
///
/// The web app uses PP-OCRv5 in wasm; here Apple's Vision framework does the
/// same job. This is the one deliberate divergence from the web stack, and it
/// is safe because the eval harness gates on TEXT fixtures: whatever produces
/// the text, the same rules engine owns what it means. The demo packets are
/// the acceptance test for this layer.
import CoreGraphics
import Vision

enum OcrError: Error, LocalizedError {
  case failed(String)
  var errorDescription: String? {
    if case .failed(let m) = self { return "Could not read the photo: \(m)" }
    return nil
  }
}

enum OcrService {
  /// Recognized text for one page, top to bottom, one recognized line per line.
  static func text(from image: CGImage) async throws -> String {
    try await withCheckedThrowingContinuation { continuation in
      let request = VNRecognizeTextRequest { request, error in
        if let error {
          continuation.resume(throwing: OcrError.failed(error.localizedDescription))
          return
        }
        let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
        // Sort by vertical position; Vision's coordinate origin is bottom-left.
        let lines =
          observations
          .sorted { $0.boundingBox.midY > $1.boundingBox.midY }
          .compactMap { $0.topCandidates(1).first?.string }
        continuation.resume(returning: lines.joined(separator: "\n"))
      }
      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["en-US", "es-US"]
      request.usesLanguageCorrection = true

      let handler = VNImageRequestHandler(cgImage: image, options: [:])
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try handler.perform([request])
        } catch {
          continuation.resume(throwing: OcrError.failed(error.localizedDescription))
        }
      }
    }
  }
}

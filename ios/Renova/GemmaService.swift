/// Gemma 4 E2B, natively, through Google's LiteRT-LM Swift API.
///
/// The mirror of the web app's model custody law: the model commits to disk
/// only after its exact byte count is verified, because a truncated file fails
/// deep inside the native library with an opaque error. Downloads resume, the
/// file is excluded from iCloud backup, and a failed warm never poisons the
/// deterministic path, which does not need any of this to work.
import Foundation
import LiteRTLM

enum GemmaError: Error, LocalizedError {
  case truncated(expected: Int64, got: Int64)
  case notReady

  var errorDescription: String? {
    switch self {
    case .truncated(let expected, let got):
      return "Model download ended at \(got) bytes, expected \(expected). Not keeping a truncated file."
    case .notReady:
      return "The model is not loaded on this device."
    }
  }
}

actor GemmaService {
  /// Exact size of gemma-4-E2B-it.litertlm (the mobile bundle), from the
  /// Hugging Face API. Any other size is a failed download.
  static let modelBytes: Int64 = 2_588_147_712

  static let remoteURL = URL(
    string:
      "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm"
  )!

  /// Native mirror of the web app's maxBufferSize gate. The mobile bundle is
  /// 2.59 GB of weights before activations; a 4 GB iPhone (11 Pro and older)
  /// cannot hold that inside an app's memory ceiling, and 6 GB devices are
  /// marginal. 7 GB asks for real headroom, so the download is only offered
  /// where the engine can actually live.
  static var deviceCanHoldModel: Bool {
    ProcessInfo.processInfo.physicalMemory >= 7_000_000_000
  }

  private var engine: Engine?

  static func localURL() throws -> URL {
    let dir = try FileManager.default.url(
      for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
    ).appendingPathComponent("Renova", isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir.appendingPathComponent("gemma-4-E2B-it.litertlm")
  }

  /// True when a byte-verified model file is on disk. Deletes wrong-size files.
  static func modelOnDisk() -> Bool {
    guard let url = try? localURL(),
      let size = try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int64
    else { return false }
    if size == modelBytes { return true }
    try? FileManager.default.removeItem(at: url)
    return false
  }

  var isReady: Bool { engine != nil }

  /// Download with progress. Verifies the exact byte count before promoting.
  static func download(progress: @MainActor @escaping (Double) -> Void) async throws {
    let delegate = DownloadProgressDelegate(expectedBytes: modelBytes, progress: progress)
    let (tempURL, response) = try await URLSession.shared.download(
      from: remoteURL, delegate: delegate)

    guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
      throw URLError(.badServerResponse)
    }

    let size =
      (try? FileManager.default.attributesOfItem(atPath: tempURL.path)[.size] as? Int64) ?? -1
    guard size == modelBytes else {
      try? FileManager.default.removeItem(at: tempURL)
      throw GemmaError.truncated(expected: modelBytes, got: size)
    }

    var destination = try localURL()
    try? FileManager.default.removeItem(at: destination)
    try FileManager.default.moveItem(at: tempURL, to: destination)

    // 2.6 GB of redownloadable weights do not belong in an iCloud backup.
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try? destination.setResourceValues(values)
  }

  /// Load the model onto the GPU. Takes ~10 s; call off the main thread.
  func warm() async throws {
    guard engine == nil else { return }
    guard Self.modelOnDisk() else { throw GemmaError.notReady }

    let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("litertlm", isDirectory: true)
    try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)

    let config = try EngineConfig(
      modelPath: try Self.localURL().path,
      backend: .gpu,
      maxNumTokens: 4096,
      cacheDir: cacheDir.path
    )
    let candidate = Engine(engineConfig: config)
    try await candidate.initialize()
    engine = candidate
  }

  /// One deterministic completion. Fresh conversation per call, same reasoning
  /// as the web app: packets are independent and history must never leak
  /// between readers.
  func generate(system: String, prompt: String, budgetSeconds: Double = 45) async throws -> String
  {
    guard let engine else { throw GemmaError.notReady }

    // topK 1 is argmax: the closest native equivalent of the web path's
    // temperature-0 fixed-seed determinism.
    let sampler = try SamplerConfig(topK: 1, topP: 1.0, temperature: 0.0, seed: 7)
    let config = ConversationConfig(
      systemMessage: Message(system, role: .system),
      samplerConfig: sampler
    )
    let conversation = try await engine.createConversation(with: config)

    // A wall-clock budget, not just a hope. A stalled generation must deliver
    // the deterministic answer, never a spinner.
    return try await withThrowingTaskGroup(of: String.self) { group in
      group.addTask {
        let response = try await conversation.sendMessage(Message(prompt))
        return response.toString
      }
      group.addTask {
        try await Task.sleep(nanoseconds: UInt64(budgetSeconds * 1_000_000_000))
        try? conversation.cancel()
        throw CancellationError()
      }
      guard let first = try await group.next() else { throw CancellationError() }
      group.cancelAll()
      return first
    }
  }
}

/// Reports download progress. URLSession calls this on its own queue.
private final class DownloadProgressDelegate: NSObject, URLSessionTaskDelegate,
  URLSessionDownloadDelegate
{
  let expectedBytes: Int64
  let progress: @MainActor (Double) -> Void

  init(expectedBytes: Int64, progress: @MainActor @escaping (Double) -> Void) {
    self.expectedBytes = expectedBytes
    self.progress = progress
  }

  func urlSession(
    _ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64,
    totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64
  ) {
    let fraction = Double(totalBytesWritten) / Double(expectedBytes)
    Task { @MainActor in self.progress(min(fraction, 1)) }
  }

  func urlSession(
    _ session: URLSession, downloadTask: URLSessionDownloadTask,
    didFinishDownloadingTo location: URL
  ) {
    // The async download(from:delegate:) API handles the file move itself.
  }
}

/// The deterministic path, verbatim.
///
/// This actor loads the esbuild bundle of the SAME TypeScript engine the web
/// app ships (rules, glossary, cross-check, prompt, prose checks) into
/// JavaScriptCore and exposes it to Swift as typed calls. There is no Swift
/// port of any safety rule; if a behaviour is not in the bundle, the app does
/// not have it. That is what keeps the iOS build inside the eval harness's
/// guarantees.
import Foundation
import JavaScriptCore

enum RulesEngineError: Error, LocalizedError {
  case bundleMissing
  case evaluationFailed(String)
  case callFailed(String)

  var errorDescription: String? {
    switch self {
    case .bundleMissing: return "renova-engine.js is not in the app bundle."
    case .evaluationFailed(let m): return "Engine bundle failed to load: \(m)"
    case .callFailed(let m): return "Engine call failed: \(m)"
    }
  }
}

actor RulesEngine {
  private let context: JSContext
  private let renova: JSValue
  private var lastException: String?

  init() throws {
    guard let url = Bundle.main.url(forResource: "renova-engine", withExtension: "js") else {
      throw RulesEngineError.bundleMissing
    }
    let source = try String(contentsOf: url, encoding: .utf8)

    guard let ctx = JSContext() else {
      throw RulesEngineError.evaluationFailed("JSContext creation failed")
    }
    var caught: String?
    ctx.exceptionHandler = { _, exception in
      caught = exception?.toString() ?? "unknown exception"
    }
    ctx.evaluateScript(source)
    if let caught { throw RulesEngineError.evaluationFailed(caught) }

    guard let obj = ctx.objectForKeyedSubscript("Renova"), !obj.isUndefined else {
      throw RulesEngineError.evaluationFailed("Renova global missing after evaluation")
    }

    self.context = ctx
    self.renova = obj
    // Re-arm the handler to record exceptions from later calls.
    ctx.exceptionHandler = { [weak self] _, exception in
      let message = exception?.toString() ?? "unknown exception"
      Task { await self?.recordException(message) }
    }
  }

  private func recordException(_ message: String) {
    lastException = message
  }

  private func call(_ name: String, _ args: [Any]) throws -> JSValue {
    lastException = nil
    guard let result = renova.invokeMethod(name, withArguments: args) else {
      throw RulesEngineError.callFailed("\(name) returned nothing")
    }
    if let lastException { throw RulesEngineError.callFailed("\(name): \(lastException)") }
    return result
  }

  private func callString(_ name: String, _ args: [Any]) throws -> String {
    let value = try call(name, args)
    guard value.isString, let s = value.toString() else {
      throw RulesEngineError.callFailed("\(name) did not return a string")
    }
    return s
  }

  // MARK: - Typed surface

  /// OCR page texts in, complete deterministic analysis out.
  func analyze(pages: [String], language: Language) throws -> Analysis {
    let pagesJson = try jsonString(pages)
    let out = try callString("analyzePages", [pagesJson, language.rawValue])
    return try Analysis.decode(out)
  }

  /// Attach prose under the full check-suite: cross-check, glossary,
  /// Spanish-intactness. `fromCache` only sets the provenance flag the UI shows.
  func attachProse(
    to analysis: Analysis, en: String, es: String, fromCache: Bool, language: Language
  ) throws -> Analysis {
    let out = try callString(
      "attachProse", [analysis.json, en, es, fromCache, language.rawValue])
    return try Analysis.decode(out)
  }

  /// The exact prompt the web app would build for these pages and fields.
  func prompt(for analysis: Analysis, pages: [String], language: Language) throws -> String {
    let pagesJson = try jsonString(pages)
    return try callString("promptFor", [analysis.json, pagesJson, language.rawValue])
  }

  func systemPrompt() throws -> String {
    guard let value = renova.objectForKeyedSubscript("SYSTEM_PROMPT"), value.isString,
      let s = value.toString()
    else {
      throw RulesEngineError.callFailed("SYSTEM_PROMPT missing")
    }
    return s
  }

  /// Cached demo prose captured from the app's own web engine, or nil.
  func demoProse(id: String) throws -> (en: String, es: String)? {
    let value = try call("demoProse", [id])
    if value.isNull || value.isUndefined { return nil }
    guard let json = value.toString(),
      let data = json.data(using: .utf8),
      let dict = try JSONSerialization.jsonObject(with: data) as? [String: String],
      let en = dict["explanationEn"], let es = dict["explanationEs"]
    else { return nil }
    return (en, es)
  }

  /// The read-aloud script, built from deterministic fields only.
  func speechScript(for analysis: Analysis, language: Language) throws -> String {
    try callString("speechScript", [analysis.json, language.rawValue])
  }

  private func jsonString(_ value: [String]) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: value)
    guard let s = String(data: data, encoding: .utf8) else {
      throw RulesEngineError.callFailed("JSON encoding failed")
    }
    return s
  }
}

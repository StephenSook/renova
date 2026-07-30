/// Codable mirrors of the JSON the JavaScriptCore bridge returns.
///
/// These structs are read-only views. Nothing in Swift constructs or mutates
/// an analysis; every value here was produced by the same TypeScript engine
/// the web app ships and the eval harness measures.
import Foundation

let ESCALATE = "ESCALATE"

struct FieldValue: Codable, Equatable {
  let value: String
  let evidence: String?
}

struct RequiredDocument: Codable, Equatable, Identifiable {
  let id: String
  let label: String
  let evidence: String?
}

struct Fields: Codable, Equatable {
  let state: String?
  let deadline: FieldValue
  let caseNumber: FieldValue
  let documents: [RequiredDocument]
  let missingDeadlineCarrier: Bool
  let escalation: String?
}

struct Mismatch: Codable, Equatable {
  let field: String
  let fromDocument: String
  let fromModel: String
  let context: String?
}

struct Helpline: Codable, Equatable {
  let name: String
  let number: String
}

struct ClosingLines: Codable, Equatable {
  let ninetyDay: String
  let help: String
}

struct AnalysisPayload: Codable, Equatable {
  let fields: Fields
  let explanationEn: String
  let explanationEs: String
  let spanishFellBack: Bool
  let mismatches: [Mismatch]
  let modelGuessedRefusedField: Bool
  let proseFromCache: Bool
  let helpline: Helpline
  let mismatchMessages: [String]
  let closing: ClosingLines
  let closingEs: ClosingLines
  let daysLeft: Int?
}

/// The decoded payload plus the exact JSON it came from, because follow-up
/// bridge calls (attachProse, speechScript) take the original JSON back.
struct Analysis: Equatable {
  let json: String
  let payload: AnalysisPayload

  static func decode(_ json: String) throws -> Analysis {
    let payload = try JSONDecoder().decode(AnalysisPayload.self, from: Data(json.utf8))
    return Analysis(json: json, payload: payload)
  }
}

enum Language: String, CaseIterable, Identifiable {
  case en, es
  var id: String { rawValue }
  var label: String { self == .en ? "English" : "Español" }
}

struct DemoScenario: Identifiable {
  let id: String
  let label: String
  let description: String
  /// Bundled image resource names, in page order.
  let images: [String]
}

/// Mirrors src/demo/scenarios.ts. The ids must match DEMO_CACHE in the bridge.
let demoScenarios: [DemoScenario] = [
  DemoScenario(
    id: "ny-pair",
    label: "New York: the form and the notice that came with it",
    description: "The deadline is on the notice, not the form.",
    images: ["ny-01-form", "ny-02-notice"]
  ),
  DemoScenario(
    id: "ca-mc216",
    label: "California: MC 216 renewal form",
    description: "The deadline is printed on the form itself.",
    images: ["ca-01-mc216"]
  ),
  DemoScenario(
    id: "adversarial",
    label: "A page that tries to trick the reader",
    description: "Printed instructions tell tools to change the deadline. They are not obeyed.",
    images: ["adversarial-injection"]
  ),
]

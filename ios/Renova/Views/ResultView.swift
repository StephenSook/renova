/// The answer. Reading order is the priority order: the deadline is the
/// largest thing on the screen, then the case number, then what to send.
/// Everything with legal weight is rendered from the bridge's constants.
import SwiftUI

private let govBlue = Color(red: 0.0, green: 0.37, blue: 0.64)
private let alertRed = Color(red: 0.71, green: 0.04, blue: 0.04)
private let warnYellow = Color(red: 1.0, green: 0.75, blue: 0.18)

struct ResultView: View {
  @EnvironmentObject var state: AppState

  private var payload: AnalysisPayload? { state.result?.analysis.payload }
  private var es: Bool { state.language == .es }

  var body: some View {
    ScrollView {
      if let p = payload {
        VStack(alignment: .leading, spacing: 0) {
          header(p)
          ForEach(Array(p.mismatchMessages.enumerated()), id: \.offset) { pair in
            mismatchBanner(message: pair.element, mismatch: p.mismatches[pair.offset])
          }
          deadline(p)
          caseNumber(p)
          documents(p)
          explanation(p)
          ninetyDay(p)
          footer(p)
          actions
        }
        .padding(20)
      }
    }
  }

  // MARK: - Sections

  private func header(_ p: AnalysisPayload) -> some View {
    HStack {
      Text(p.fields.state.map { "Medicaid (\($0))" } ?? "Medicaid")
        .font(.subheadline)
        .foregroundStyle(.secondary)
      Spacer()
      Picker("Language", selection: languageBinding) {
        ForEach(Language.allCases) { lang in
          Text(lang.label).tag(lang)
        }
      }
      .pickerStyle(.segmented)
      .frame(width: 190)
    }
    .padding(.vertical, 12)
  }

  private var languageBinding: Binding<Language> {
    Binding(
      get: { state.language },
      set: { state.switchLanguage(to: $0) }
    )
  }

  private func mismatchBanner(message: String, mismatch: Mismatch) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(message).font(.body.bold())
      Text(es ? "DE SU DOCUMENTO" : "FROM YOUR DOCUMENT")
        .font(.caption)
        .kerning(1)
        .foregroundStyle(.secondary)
      Text(mismatch.fromDocument).font(.title3.bold())
    }
    .padding(14)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(warnYellow.opacity(0.15))
    .overlay(Rectangle().frame(width: 4).foregroundStyle(warnYellow), alignment: .leading)
    .padding(.bottom, 12)
  }

  private func deadline(_ p: AnalysisPayload) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      sectionLabel(es ? "SU FECHA LÍMITE" : "YOUR DEADLINE")

      if p.fields.deadline.value == ESCALATE {
        Text(
          es
            ? "No pudimos leer su fecha límite en estas fotos"
            : "We could not read your deadline from these photos"
        )
        .font(.title.bold())
        .foregroundStyle(alertRed)

        if let escalation = p.fields.escalation {
          Text(escalation).font(.body)
        }
        if p.fields.missingDeadlineCarrier {
          Text(
            es
              ? "Es probable que su fecha límite no esté en el formulario que fotografió. Busque el aviso por separado que vino en el mismo sobre y escanéelo también."
              : "Your deadline is probably not on the form you photographed. Look for the separate notice that came in the same envelope and scan that too."
          )
          .font(.body.bold())
          .padding(12)
          .background(govBlue.opacity(0.08))
          .overlay(Rectangle().frame(width: 4).foregroundStyle(govBlue), alignment: .leading)
        }
        callButton(p)
      } else {
        Text(formattedDeadline(p.fields.deadline.value))
          .font(.system(size: 44, weight: .heavy))
          .minimumScaleFactor(0.6)

        if let days = p.daysLeft {
          Text(es ? "Quedan \(days) días" : "\(days) days left")
            .font(.title3.bold())
            .foregroundStyle(days <= 7 ? alertRed : .secondary)
        }
      }
    }
    .padding(.top, 12)
    .frame(maxWidth: .infinity, alignment: .leading)
    .overlay(Rectangle().frame(height: 4).foregroundStyle(.primary), alignment: .top)
  }

  private func caseNumber(_ p: AnalysisPayload) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      sectionLabel(es ? "SU NÚMERO DE CASO" : "YOUR CASE NUMBER")
      Text(
        p.fields.caseNumber.value == ESCALATE
          ? (es ? "No lo pudimos leer" : "We could not read it")
          : p.fields.caseNumber.value
      )
      .font(.system(.title, design: .monospaced).bold())
    }
    .padding(.top, 24)
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func documents(_ p: AnalysisPayload) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      sectionLabel(es ? "LO QUE DEBE ENVIAR" : "WHAT TO SEND")
      if p.fields.documents.isEmpty {
        // Silence here is dangerous: absence reads as "nothing to send".
        Text(
          es
            ? "No pudimos leer la lista de documentos en estas fotos. Su paquete casi siempre pide comprobantes. Revise el papel o llame al número de abajo."
            : "We could not read the list of documents from these photos. Your packet almost always asks for proof of something. Check the paper, or call the number below."
        )
        .font(.body.bold())
        .foregroundStyle(alertRed)
      } else {
        ForEach(p.fields.documents) { doc in
          DocumentRow(label: doc.label)
        }
      }
    }
    .padding(.top, 24)
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  @ViewBuilder private func explanation(_ p: AnalysisPayload) -> some View {
    let prose = es ? p.explanationEs : p.explanationEn
    let hasProse = !(p.explanationEn.isEmpty && p.explanationEs.isEmpty)

    if hasProse && !p.modelGuessedRefusedField {
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          sectionLabel(es ? "QUÉ DICE ESTA CARTA" : "WHAT THIS LETTER SAYS")
          Spacer()
          listenButton
        }
        if es && p.spanishFellBack {
          Text(
            "La explicación en español no se pudo generar correctamente en este dispositivo. La información importante que aparece arriba es completa y correcta."
          )
          .font(.body)
        } else {
          Text(prose).font(.body)
        }
        if p.proseFromCache && !(es && p.spanishFellBack) {
          Text(
            es
              ? "Esta explicación es una respuesta guardada del propio motor Gemma 4 de esta aplicación, registrada antes con la misma configuración fija que usa en vivo. Descargue el modelo en la primera pantalla para generarla en este iPhone."
              : "This explanation is a saved answer from this app's own Gemma 4 engine, recorded earlier at the same fixed settings it uses live. Download the model on the first screen to run it on this iPhone."
          )
          .font(.footnote)
          .foregroundStyle(.secondary)
          .padding(10)
          .background(govBlue.opacity(0.06))
          .overlay(
            Rectangle().frame(width: 4).foregroundStyle(.secondary), alignment: .leading)
        }
      }
      .padding(.top, 24)
      .frame(maxWidth: .infinity, alignment: .leading)
    } else if p.modelGuessedRefusedField || state.result?.modelError != nil {
      // A model failure must look different from a model never downloaded.
      VStack(alignment: .leading, spacing: 8) {
        sectionLabel(es ? "QUÉ DICE ESTA CARTA" : "WHAT THIS LETTER SAYS")
        Text(
          es
            ? "La explicación escrita no se pudo generar en este dispositivo. Lo que aparece arriba se leyó directamente de su documento y está completo."
            : "The written explanation could not be produced on this device. What is shown above was read from your document and is complete."
        )
        .font(.body)
      }
      .padding(.top, 24)
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var listenButton: some View {
    Button {
      if state.speech.speaking {
        state.speech.stop()
      } else if let result = state.result, let rules = state.rules {
        let language = state.language
        Task {
          if let script = try? await rules.speechScript(for: result.analysis, language: language)
          {
            state.speech.speak(script, language: language)
          }
        }
      }
    } label: {
      Text(state.speech.speaking ? (es ? "Detener" : "Stop") : (es ? "Escuchar" : "Listen"))
        .font(.subheadline.bold())
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
    }
    .buttonStyle(.bordered)
    .tint(govBlue)
  }

  private func ninetyDay(_ p: AnalysisPayload) -> some View {
    Text(es ? p.closingEs.ninetyDay : p.closing.ninetyDay)
      .font(.body.bold())
      .padding(16)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(govBlue.opacity(0.08))
      .overlay(Rectangle().frame(width: 4).foregroundStyle(govBlue), alignment: .leading)
      .padding(.top, 24)
  }

  private func footer(_ p: AnalysisPayload) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(es ? p.closingEs.help : p.closing.help)
        .font(.subheadline)
        .foregroundStyle(.secondary)
      callButton(p)
    }
    .padding(.top, 20)
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func callButton(_ p: AnalysisPayload) -> some View {
    let digits = p.helpline.number.filter { $0.isNumber || $0 == "+" }
    return Group {
      if let url = URL(string: "tel:\(digits)") {
        Link(destination: url) {
          Text("\(es ? "Llamar a" : "Call") \(p.helpline.name)")
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 52)
        }
        .buttonStyle(.borderedProminent)
        .tint(govBlue)
      }
    }
  }

  private var actions: some View {
    VStack(alignment: .leading, spacing: 12) {
      Button {
        state.result = nil
        state.screen = .capture
      } label: {
        Text(es ? "Leer otro paquete" : "Read another packet")
          .font(.headline)
          .frame(maxWidth: .infinity, minHeight: 52)
      }
      .buttonStyle(.bordered)

      Text(
        es
          ? "Esta herramienta explica su paquete de renovación en lenguaje sencillo. No es asesoramiento legal y no reemplaza la orientación de su oficina estatal de Medicaid."
          : "This tool explains your renewal packet in plain language. It is not legal advice and does not replace guidance from your state Medicaid office."
      )
      .font(.footnote)
      .foregroundStyle(.secondary)
    }
    .padding(.top, 24)
    .padding(.bottom, 40)
  }

  private func sectionLabel(_ text: String) -> some View {
    Text(text)
      .font(.footnote.bold())
      .kerning(1)
      .foregroundStyle(.secondary)
  }

  /// Format the ISO date Swift-side with the system calendar, dodging the
  /// stripped-ICU risk found in the jsc CLI during the spike.
  private func formattedDeadline(_ iso: String) -> String {
    let parser = DateFormatter()
    parser.dateFormat = "yyyy-MM-dd"
    parser.locale = Locale(identifier: "en_US_POSIX")
    guard let date = parser.date(from: iso) else { return iso }
    let formatter = DateFormatter()
    formatter.dateStyle = .full
    formatter.locale = Locale(identifier: es ? "es_US" : "en_US")
    return formatter.string(from: date)
  }
}

private struct DocumentRow: View {
  let label: String
  @State private var checked = false

  var body: some View {
    Button {
      checked.toggle()
    } label: {
      HStack(spacing: 14) {
        Image(systemName: checked ? "checkmark.square.fill" : "square")
          .font(.title2)
          .foregroundStyle(checked ? govBlue : .secondary)
        Text(label).font(.body).strikethrough(checked)
        Spacer()
      }
      .frame(minHeight: 48)
    }
    .buttonStyle(.plain)
  }
}

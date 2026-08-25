// AssessmentDetail.jsx
// The core of the JD-Based Agentic AI Assessment module.
//
// Steps shown on this one page:
//   1. Review the JD text
//   2. Run the JD Analysis Agent -> review extracted requirements
//   3. Run the Assessment Agent -> review/edit the 3 generated tests
//   4. Approve each test, then approve the whole assessment
//
// Nothing here ever auto-finalizes anything — every AI output is a
// draft the recruiter must review, edit if needed, and explicitly approve.

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppShell from "../components/AppShell";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const TEST_META = {
  knowledge_reasoning: { label: "Test 1 — Knowledge & Reasoning", icon: "🧠" },
  situational_judgment: { label: "Test 2 — Job Situational Judgment", icon: "🧭" },
  practical_simulation: { label: "Test 3 — Practical Job Simulation", icon: "🛠️" },
};

function Chip({ children }) {
  return (
    <span className="inline-block bg-surface-2 border border-border text-text text-xs px-2.5 py-1 rounded-full mr-1.5 mb-1.5">
      {children}
    </span>
  );
}

function FieldLabel({ children }) {
  return <label className="text-xs text-muted uppercase tracking-wide">{children}</label>;
}

const inputClass =
  "w-full mt-1 px-3 py-2 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition text-sm";

// ---------------------------------------------------------------------------
// Small reusable list editor for arrays of plain strings (options, tools)
// ---------------------------------------------------------------------------
function StringListEditor({ label, items, onChange, placeholder }) {
  function update(i, value) {
    const next = [...items];
    next[i] = value;
    onChange(next);
  }
  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, ""]);
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-col gap-1.5 mt-1">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              type="text"
              value={item}
              placeholder={placeholder}
              onChange={(e) => update(i, e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:border-gold"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted hover:text-danger text-xs px-2"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="text-xs text-gold hover:text-gold-dim text-left mt-0.5"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test 1 — Knowledge & Reasoning editor
// ---------------------------------------------------------------------------
function KnowledgeReasoningEditor({ content, onChange }) {
  const questions = content.questions || [];

  function updateQuestion(i, patch) {
    const next = questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q));
    onChange({ ...content, questions: next });
  }
  function removeQuestion(i) {
    onChange({ ...content, questions: questions.filter((_, idx) => idx !== i) });
  }
  function addQuestion() {
    onChange({
      ...content,
      questions: [
        ...questions,
        { type: "mcq", question: "", options: ["", "", "", ""], correct_answer: "", explanation: "", points: 0 },
      ],
    });
  }

  const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <p className={`text-xs ${totalPoints === 100 ? "text-success" : "text-gold"}`}>
        Points total: {totalPoints} / 100 {totalPoints !== 100 && "(should sum to 100)"}
      </p>
      {questions.map((q, i) => (
        <div key={i} className="border border-border rounded-lg p-4 bg-ink/40">
          <div className="flex items-center justify-between mb-2">
            <select
              value={q.type}
              onChange={(e) => updateQuestion(i, { type: e.target.value })}
              className="text-xs bg-surface-2 border border-border rounded px-2 py-1 text-text"
            >
              <option value="mcq">MCQ</option>
              <option value="numerical">Numerical</option>
              <option value="technical">Technical</option>
              <option value="situational">Situational</option>
            </select>
            <button onClick={() => removeQuestion(i)} className="text-muted hover:text-danger text-xs">
              ✕ Remove
            </button>
          </div>

          <FieldLabel>Question</FieldLabel>
          <textarea
            rows={2}
            value={q.question || ""}
            onChange={(e) => updateQuestion(i, { question: e.target.value })}
            className={inputClass + " resize-none"}
          />

          {q.type === "mcq" && (
            <div className="mt-3">
              <StringListEditor
                label="Options"
                items={q.options || []}
                onChange={(options) => updateQuestion(i, { options })}
              />
              <div className="mt-3">
                <FieldLabel>Correct Answer</FieldLabel>
                <input
                  type="text"
                  value={q.correct_answer || ""}
                  onChange={(e) => updateQuestion(i, { correct_answer: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {q.type === "numerical" && (
            <div className="mt-3">
              <FieldLabel>Correct Answer</FieldLabel>
              <input
                type="text"
                value={q.correct_answer || ""}
                onChange={(e) => updateQuestion(i, { correct_answer: e.target.value })}
                className={inputClass}
              />
            </div>
          )}

          {(q.type === "technical" || q.type === "situational") && (
            <div className="mt-3">
              <FieldLabel>Expected Answer Points (one per line)</FieldLabel>
              <textarea
                rows={2}
                value={(q.expected_answer_points || []).join("\n")}
                onChange={(e) =>
                  updateQuestion(i, { expected_answer_points: e.target.value.split("\n") })
                }
                className={inputClass + " resize-none"}
              />
            </div>
          )}

          <div className="mt-3">
            <FieldLabel>Explanation (used by the Evaluation Agent later)</FieldLabel>
            <textarea
              rows={2}
              value={q.explanation || ""}
              onChange={(e) => updateQuestion(i, { explanation: e.target.value })}
              className={inputClass + " resize-none"}
            />
          </div>

          <div className="mt-3 w-32">
            <FieldLabel>Points</FieldLabel>
            <input
              type="number"
              value={q.points ?? 0}
              onChange={(e) => updateQuestion(i, { points: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        </div>
      ))}
      <button type="button" onClick={addQuestion} className="text-sm text-gold hover:text-gold-dim text-left">
        + Add Question
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test 2 — Job Situational Judgment editor
// ---------------------------------------------------------------------------
function SituationalJudgmentEditor({ content, onChange }) {
  const scenarios = content.scenarios || [];

  function updateScenario(i, patch) {
    const next = scenarios.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange({ ...content, scenarios: next });
  }
  function removeScenario(i) {
    onChange({ ...content, scenarios: scenarios.filter((_, idx) => idx !== i) });
  }
  function addScenario() {
    onChange({
      ...content,
      scenarios: [
        ...scenarios,
        { scenario: "", question: "What would you do?", options: ["", "", "", ""], best_option: "", explanation: "", points: 0 },
      ],
    });
  }

  const totalPoints = scenarios.reduce((sum, s) => sum + (Number(s.points) || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <p className={`text-xs ${totalPoints === 100 ? "text-success" : "text-gold"}`}>
        Points total: {totalPoints} / 100 {totalPoints !== 100 && "(should sum to 100)"}
      </p>
      {scenarios.map((s, i) => (
        <div key={i} className="border border-border rounded-lg p-4 bg-ink/40">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted uppercase tracking-wide">Scenario {i + 1}</p>
            <button onClick={() => removeScenario(i)} className="text-muted hover:text-danger text-xs">
              ✕ Remove
            </button>
          </div>

          <FieldLabel>Scenario</FieldLabel>
          <textarea
            rows={2}
            value={s.scenario || ""}
            onChange={(e) => updateScenario(i, { scenario: e.target.value })}
            className={inputClass + " resize-none"}
          />

          <div className="mt-3">
            <FieldLabel>Question</FieldLabel>
            <input
              type="text"
              value={s.question || ""}
              onChange={(e) => updateScenario(i, { question: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="mt-3">
            <StringListEditor
              label="Response Options"
              items={s.options || []}
              onChange={(options) => updateScenario(i, { options })}
            />
          </div>

          <div className="mt-3">
            <FieldLabel>Best Option</FieldLabel>
            <input
              type="text"
              value={s.best_option || ""}
              onChange={(e) => updateScenario(i, { best_option: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="mt-3">
            <FieldLabel>Explanation</FieldLabel>
            <textarea
              rows={2}
              value={s.explanation || ""}
              onChange={(e) => updateScenario(i, { explanation: e.target.value })}
              className={inputClass + " resize-none"}
            />
          </div>

          <div className="mt-3 w-32">
            <FieldLabel>Points</FieldLabel>
            <input
              type="number"
              value={s.points ?? 0}
              onChange={(e) => updateScenario(i, { points: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        </div>
      ))}
      <button type="button" onClick={addScenario} className="text-sm text-gold hover:text-gold-dim text-left">
        + Add Scenario
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test 3 — Practical Job Simulation editor
// ---------------------------------------------------------------------------
function PracticalSimulationEditor({ content, aiAllowed, allowedTools, onContentChange, onAiAllowedChange, onAllowedToolsChange }) {
  const criteria = content.evaluation_criteria || [];

  function updateCriterion(i, patch) {
    const next = criteria.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    onContentChange({ ...content, evaluation_criteria: next });
  }
  function removeCriterion(i) {
    onContentChange({ ...content, evaluation_criteria: criteria.filter((_, idx) => idx !== i) });
  }
  function addCriterion() {
    onContentChange({
      ...content,
      evaluation_criteria: [...criteria, { criterion: "", weight: 0 }],
    });
  }

  const toolsArray = (allowedTools || "").split(",").map((t) => t.trim()).filter(Boolean);
  const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel>Task Description</FieldLabel>
        <textarea
          rows={4}
          value={content.task_description || ""}
          onChange={(e) => onContentChange({ ...content, task_description: e.target.value })}
          className={inputClass + " resize-none"}
        />
      </div>

      <div>
        <FieldLabel>Deliverable Instructions (what to submit, and how)</FieldLabel>
        <textarea
          rows={3}
          value={content.deliverable_instructions || ""}
          onChange={(e) => onContentChange({ ...content, deliverable_instructions: e.target.value })}
          className={inputClass + " resize-none"}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 bg-ink/40 border border-border rounded-lg p-4">
        <div>
          <FieldLabel>AI Tool Use</FieldLabel>
          <div className="flex gap-4 mt-2">
            <label className="flex items-center gap-1.5 text-sm text-text">
              <input
                type="radio"
                checked={aiAllowed === "allowed"}
                onChange={() => onAiAllowedChange("allowed")}
              />
              Allowed
            </label>
            <label className="flex items-center gap-1.5 text-sm text-text">
              <input
                type="radio"
                checked={aiAllowed !== "allowed"}
                onChange={() => onAiAllowedChange("not_allowed")}
              />
              Not Allowed
            </label>
          </div>
          <p className="text-xs text-muted/70 mt-1.5">
            This is the recruiter's call — the AI only suggests a default.
          </p>
        </div>

        <div>
          <StringListEditor
            label="Allowed Tools (only shown if AI is allowed)"
            items={toolsArray}
            onChange={(next) => onAllowedToolsChange(next.join(", "))}
            placeholder="e.g. ChatGPT"
          />
        </div>
      </div>

      <div>
        <p className={`text-xs mb-1 ${totalWeight === 100 ? "text-success" : "text-gold"}`}>
          Evaluation weight total: {totalWeight} / 100 {totalWeight !== 100 && "(should sum to 100)"}
        </p>
        {criteria.map((c, i) => (
          <div key={i} className="flex gap-2 items-center mb-1.5">
            <input
              type="text"
              value={c.criterion || ""}
              placeholder="Criterion"
              onChange={(e) => updateCriterion(i, { criterion: e.target.value })}
              className="flex-1 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:border-gold"
            />
            <input
              type="number"
              value={c.weight ?? 0}
              onChange={(e) => updateCriterion(i, { weight: Number(e.target.value) })}
              className="w-20 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text text-sm focus:outline-none focus:border-gold"
            />
            <button onClick={() => removeCriterion(i)} className="text-muted hover:text-danger text-xs px-1">
              ✕
            </button>
          </div>
        ))}
        <button type="button" onClick={addCriterion} className="text-xs text-gold hover:text-gold-dim">
          + Add Criterion
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One test card: header (title/instructions/duration) + type-specific editor
// + save/approve controls
// ---------------------------------------------------------------------------
function TestCard({ test, onSaved }) {
  const [title, setTitle] = useState(test.title);
  const [instructions, setInstructions] = useState(test.instructions || "");
  const [duration, setDuration] = useState(test.duration_minutes);
  const [content, setContent] = useState(test.content);
  const [aiAllowed, setAiAllowed] = useState(test.ai_allowed || "not_allowed");
  const [allowedTools, setAllowedTools] = useState(test.allowed_tools || "");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  const meta = TEST_META[test.test_type] || { label: test.title, icon: "📋" };
  const isApproved = test.status === "approved";

  function markDirty(fn) {
    return (...args) => {
      fn(...args);
      setDirty(true);
    };
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${BASE_URL}/assessments/${test.assessment_id}/tests/${test.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          instructions,
          duration_minutes: Number(duration),
          content,
          ai_allowed: test.test_type === "practical_simulation" ? aiAllowed : null,
          allowed_tools: test.test_type === "practical_simulation" ? allowedTools : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to save test");
      setDirty(false);
      onSaved(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    setError("");
    try {
      const endpoint = isApproved ? "unapprove" : "approve";
      const response = await fetch(
        `${BASE_URL}/assessments/${test.assessment_id}/tests/${test.id}/${endpoint}`,
        { method: "POST" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Action failed");
      onSaved(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-xl text-text">
          <span className="mr-2">{meta.icon}</span>
          {meta.label}
        </p>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
            isApproved ? "bg-success/10 text-success border-success/30" : "bg-gold/10 text-gold border-gold/30"
          }`}
        >
          {isApproved ? "✓ Approved" : "Needs Review"}
        </span>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <fieldset disabled={isApproved} className={isApproved ? "opacity-70" : ""}>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-2">
            <FieldLabel>Test Title</FieldLabel>
            <input
              type="text"
              value={title}
              onChange={markDirty((e) => setTitle(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel>Duration (minutes)</FieldLabel>
            <input
              type="number"
              value={duration}
              onChange={markDirty((e) => setDuration(e.target.value))}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mb-4">
          <FieldLabel>Instructions shown to the candidate</FieldLabel>
          <textarea
            rows={2}
            value={instructions}
            onChange={markDirty((e) => setInstructions(e.target.value))}
            className={inputClass + " resize-none"}
          />
        </div>

        {test.test_type === "knowledge_reasoning" && (
          <KnowledgeReasoningEditor content={content} onChange={markDirty(setContent)} />
        )}
        {test.test_type === "situational_judgment" && (
          <SituationalJudgmentEditor content={content} onChange={markDirty(setContent)} />
        )}
        {test.test_type === "practical_simulation" && (
          <PracticalSimulationEditor
            content={content}
            aiAllowed={aiAllowed}
            allowedTools={allowedTools}
            onContentChange={markDirty(setContent)}
            onAiAllowedChange={markDirty(setAiAllowed)}
            onAllowedToolsChange={markDirty(setAllowedTools)}
          />
        )}
      </fieldset>

      <div className="flex gap-3 mt-5 pt-4 border-t border-border">
        {!isApproved && (
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-surface-2 hover:bg-border border border-border transition text-text text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
        <button
          onClick={handleApprove}
          disabled={approving || dirty}
          title={dirty ? "Save your changes first" : ""}
          className={`text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-40 ${
            isApproved
              ? "bg-surface-2 hover:bg-border border border-border text-text"
              : "bg-gold hover:bg-gold-dim text-ink"
          }`}
        >
          {approving ? "..." : isApproved ? "Unapprove (Edit Again)" : "Approve This Test"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function AssessmentDetail() {
  const { assessmentId } = useParams();

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [showJd, setShowJd] = useState(false);

  async function load() {
    try {
      const response = await fetch(`${BASE_URL}/assessments/${assessmentId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to load assessment");
      setAssessment(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError("");
    try {
      const response = await fetch(`${BASE_URL}/assessments/${assessmentId}/analyze`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "JD analysis failed");
      setAssessment(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerateTests() {
    if (
      assessment.tests.length > 0 &&
      !window.confirm("This will replace the existing 3 tests with a freshly generated set. Continue?")
    ) {
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const response = await fetch(`${BASE_URL}/assessments/${assessmentId}/generate-tests`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Test generation failed");
      setAssessment(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    setError("");
    try {
      const response = await fetch(`${BASE_URL}/assessments/${assessmentId}/approve`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not finalize assessment");
      setAssessment(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setFinalizing(false);
    }
  }

  function handleTestSaved(updatedTest) {
    setAssessment((prev) => ({
      ...prev,
      tests: prev.tests.map((t) => (t.id === updatedTest.id ? updatedTest : t)),
      status: prev.status === "approved" ? "tests_generated" : prev.status,
    }));
  }

  if (loading) {
    return (
      <AppShell>
        <p className="text-muted text-sm">Loading...</p>
      </AppShell>
    );
  }

  if (!assessment) {
    return (
      <AppShell>
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 max-w-lg">
          {error || "Assessment not found"}
        </div>
      </AppShell>
    );
  }

  const technicalSkills = (assessment.extracted_technical_skills || "").split(",").map((s) => s.trim()).filter(Boolean);
  const softSkills = (assessment.extracted_soft_skills || "").split(",").map((s) => s.trim()).filter(Boolean);
  const qualifications = (assessment.extracted_qualifications || "").split(";").map((s) => s.trim()).filter(Boolean);
  const responsibilities = (assessment.extracted_responsibilities || "").split(";").map((s) => s.trim()).filter(Boolean);

  const allApproved = assessment.tests.length === 3 && assessment.tests.every((t) => t.status === "approved");

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-2">
        <Link to="/assessments" className="text-muted text-sm hover:text-text">
          ← Assessments
        </Link>
      </div>
      <p className="font-mono text-xs text-gold tracking-widest mb-2">JD-BASED AGENTIC AI ASSESSMENT</p>
      <h1 className="font-display text-3xl text-text mb-4">{assessment.title}</h1>

      {error && (
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4 max-w-2xl">
          {error}
        </div>
      )}

      {assessment.status === "approved" && (
        <div className="bg-success/10 border border-success/40 text-success text-sm rounded-lg px-4 py-3 mb-6 max-w-2xl">
          ✓ All 3 tests are approved and this assessment is finalized. Delivering it to
          candidates and AI-based evaluation are handled in the next phase of this module.
        </div>
      )}

      {/* JD text */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-6 max-w-3xl">
        <button
          onClick={() => setShowJd((v) => !v)}
          className="text-sm text-text font-medium flex items-center gap-2"
        >
          {showJd ? "▾" : "▸"} Job Description
        </button>
        {showJd && (
          <pre className="text-muted text-sm mt-3 whitespace-pre-wrap font-body">{assessment.jd_text}</pre>
        )}
      </div>

      {/* Step 2: JD Analysis Agent */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-xl text-text">JD Analysis</p>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="bg-gold hover:bg-gold-dim transition text-ink text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {analyzing ? "Analyzing..." : assessment.status === "draft" ? "Analyze JD with AI" : "Re-analyze JD"}
          </button>
        </div>

        {assessment.status === "draft" ? (
          <p className="text-muted text-sm">
            Run the JD Analysis Agent to extract required skills, qualifications, experience, and
            responsibilities directly from the job description above.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {assessment.analysis_summary && (
              <p className="text-text text-sm italic border-l-2 border-gold pl-3">{assessment.analysis_summary}</p>
            )}
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1.5">Technical Skills</p>
              <div>{technicalSkills.map((s, i) => <Chip key={i}>{s}</Chip>)}</div>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1.5">Soft Skills</p>
              <div>{softSkills.map((s, i) => <Chip key={i}>{s}</Chip>)}</div>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1.5">Qualifications</p>
              <ul className="list-disc list-inside text-sm text-text">
                {qualifications.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1.5">Experience Required</p>
              <p className="text-sm text-text">{assessment.extracted_experience}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1.5">Responsibilities</p>
              <ul className="list-disc list-inside text-sm text-text">
                {responsibilities.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Assessment Agent — generate tests */}
      {assessment.status !== "draft" && (
        <div className="bg-surface border border-border rounded-xl p-6 mb-6 max-w-3xl">
          <div className="flex items-center justify-between mb-2">
            <p className="font-display text-xl text-text">3 Job-Specific Tests</p>
            <button
              onClick={handleGenerateTests}
              disabled={generating}
              className="bg-gold hover:bg-gold-dim transition text-ink text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {generating ? "Generating..." : assessment.tests.length === 0 ? "Generate 3 Tests" : "Regenerate All Tests"}
            </button>
          </div>
          {assessment.tests.length === 0 && (
            <p className="text-muted text-sm">
              The Assessment Agent will build a Knowledge & Reasoning test, a Situational Judgment
              test, and a Practical Job Simulation task — based only on the extracted requirements above.
            </p>
          )}
        </div>
      )}

      {/* Test cards */}
      {assessment.tests.length > 0 && (
        <div className="flex flex-col gap-6 max-w-3xl">
          {assessment.tests.map((test) => (
            <TestCard key={test.id} test={test} onSaved={handleTestSaved} />
          ))}
        </div>
      )}

      {/* Step 4: finalize */}
      {assessment.tests.length === 3 && assessment.status !== "approved" && (
        <div className="bg-surface border border-border rounded-xl p-6 mt-6 max-w-3xl flex items-center justify-between">
          <div>
            <p className="text-text font-medium">Finalize this assessment</p>
            <p className="text-muted text-sm">
              All 3 tests must be individually approved first.{" "}
              {!allApproved && "Recruiter review is required before this can go live."}
            </p>
          </div>
          <button
            onClick={handleFinalize}
            disabled={!allApproved || finalizing}
            className="bg-gold hover:bg-gold-dim transition text-ink font-semibold px-5 py-2.5 rounded-lg disabled:opacity-40 whitespace-nowrap"
          >
            {finalizing ? "Finalizing..." : "Approve & Finalize"}
          </button>
        </div>
      )}
    </AppShell>
  );
}

export default AssessmentDetail;

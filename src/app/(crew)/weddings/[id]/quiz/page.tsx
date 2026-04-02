"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X, RotateCcw, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correct_index: number;
}

interface QuizResponse {
  question_index: number;
  selected_index: number;
  correct: boolean;
}

type QuizState = "loading" | "active" | "feedback" | "passed" | "failed";

export default function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [state, setState] = useState<QuizState>("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [coupleName, setCoupleName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("shooter_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!profile) return;
      setProfileId(profile.id);

      // Load quiz questions
      const { data: wedding } = await supabase
        .from("weddings")
        .select("quiz_questions, couple_id")
        .eq("id", id)
        .single();

      if (wedding) {
        const qs = Array.isArray(wedding.quiz_questions) ? wedding.quiz_questions as QuizQuestion[] : [];
        setQuestions(qs);

        if (wedding.couple_id) {
          const { data: couple } = await supabase
            .from("couples")
            .select("names")
            .eq("id", wedding.couple_id)
            .single();
          if (couple) setCoupleName(couple.names);
        }
      }

      // Load assignment
      const { data: assignment } = await supabase
        .from("assignments")
        .select("id, quiz_passed")
        .eq("wedding_id", id)
        .eq("shooter_id", profile.id)
        .single();

      if (assignment) {
        setAssignmentId(assignment.id);
        if (assignment.quiz_passed) {
          setState("passed");
          return;
        }
      }

      setState("active");
    }
    load();
  }, [id]);

  function handleSelectAnswer(optionIndex: number) {
    if (selectedIndex !== null) return; // Already selected
    setSelectedIndex(optionIndex);

    const isCorrect = optionIndex === questions[currentIndex].correct_index;
    const response: QuizResponse = {
      question_index: currentIndex,
      selected_index: optionIndex,
      correct: isCorrect,
    };
    setResponses((prev) => [...prev, response]);

    // Show feedback, then auto-advance after delay
    setState("feedback");
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setSelectedIndex(null);
        setState("active");
      } else {
        // Quiz complete — check results
        const allResponses = [...responses, response];
        const allCorrect = allResponses.every((r) => r.correct);
        finishQuiz(allResponses, allCorrect);
      }
    }, 1200);
  }

  async function finishQuiz(allResponses: QuizResponse[], passed: boolean) {
    setSaving(true);
    const supabase = createClient();

    if (assignmentId) {
      // Increment attempts
      const { data: assignment } = await supabase
        .from("assignments")
        .select("quiz_attempts")
        .eq("id", assignmentId)
        .single();

      const attempts = (assignment?.quiz_attempts || 0) + 1;

      const updateData: Record<string, unknown> = {
        quiz_attempts: attempts,
      };

      if (passed) {
        updateData.quiz_passed = true;
        updateData.quiz_passed_at = new Date().toISOString();
      }

      await supabase
        .from("assignments")
        .update(updateData)
        .eq("id", assignmentId);

      // Insert quiz response
      await supabase.from("quiz_responses").insert({
        assignment_id: assignmentId,
        responses: allResponses,
        passed,
      });
    }

    setSaving(false);
    setState(passed ? "passed" : "failed");
  }

  function handleRetake() {
    setCurrentIndex(0);
    setSelectedIndex(null);
    setResponses([]);
    setState("active");
  }

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading quiz...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">No quiz questions available yet.</p>
        <Link href={`/weddings/${id}`} className="mt-4 text-sm text-primary hover:underline">
          Back to brief
        </Link>
      </div>
    );
  }

  // Passed screen
  if (state === "passed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-success/15">
          <PartyPopper className="size-12 text-success" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">You&apos;re ready!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You passed the quiz for {coupleName}&apos;s wedding.
        </p>
        <Button
          onClick={() => router.push(`/weddings/${id}`)}
          className="mt-6 gap-1.5 bg-primary text-white hover:bg-primary-hover"
        >
          Back to Brief
        </Button>
      </div>
    );
  }

  // Failed screen
  if (state === "failed") {
    const wrongCount = responses.filter((r) => !r.correct).length;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-error/15">
          <X className="size-12 text-error" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Not quite</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You got {wrongCount} question{wrongCount !== 1 ? "s" : ""} wrong. Review the brief and try again.
        </p>

        {/* Show which questions were wrong */}
        <div className="mt-6 w-full max-w-sm space-y-2">
          {responses.map((r, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                r.correct ? "bg-success/10 text-success" : "bg-error/10 text-error"
              )}
            >
              {r.correct ? <Check className="size-4 shrink-0" /> : <X className="size-4 shrink-0" />}
              <span className="flex-1 truncate">{questions[r.question_index]?.question}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(`/weddings/${id}`)}
            className="gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            Review Brief
          </Button>
          <Button
            onClick={handleRetake}
            className="gap-1.5 bg-primary text-white hover:bg-primary-hover"
          >
            <RotateCcw className="size-3.5" />
            Retake
          </Button>
        </div>
      </div>
    );
  }

  // Active quiz / feedback state
  const question = questions[currentIndex];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Progress bar */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <Link href={`/weddings/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <span className="text-xs font-medium text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <div className="w-4" />
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${((currentIndex + (state === "feedback" ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <h2 className="mb-8 text-center text-lg font-semibold text-foreground">
            {question.question}
          </h2>

          <div className="space-y-3">
            {question.options.map((option, oi) => {
              if (!option) return null;

              const isSelected = selectedIndex === oi;
              const isCorrect = oi === question.correct_index;
              const showFeedback = state === "feedback";

              return (
                <button
                  key={oi}
                  type="button"
                  onClick={() => handleSelectAnswer(oi)}
                  disabled={state === "feedback" || saving}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-4 text-left text-sm font-medium transition-all",
                    // Default
                    !showFeedback && !isSelected && "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/50",
                    // Selected + correct
                    showFeedback && isSelected && isCorrect && "border-success bg-success/10 text-success",
                    // Selected + wrong
                    showFeedback && isSelected && !isCorrect && "border-error bg-error/10 text-error",
                    // Not selected but is the correct answer (show after wrong pick)
                    showFeedback && !isSelected && isCorrect && "border-success/50 bg-success/5 text-success",
                    // Not selected, not correct, feedback showing
                    showFeedback && !isSelected && !isCorrect && "border-border/50 bg-card text-muted-foreground/50",
                  )}
                >
                  <span className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    showFeedback && isSelected && isCorrect && "bg-success text-white",
                    showFeedback && isSelected && !isCorrect && "bg-error text-white",
                    showFeedback && !isSelected && isCorrect && "bg-success/20 text-success",
                    !showFeedback && "bg-muted text-muted-foreground",
                    showFeedback && !isSelected && !isCorrect && "bg-muted/50 text-muted-foreground/50",
                  )}>
                    {showFeedback && isSelected && isCorrect ? <Check className="size-4" /> :
                     showFeedback && isSelected && !isCorrect ? <X className="size-4" /> :
                     String.fromCharCode(65 + oi)}
                  </span>
                  <span className="flex-1">{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

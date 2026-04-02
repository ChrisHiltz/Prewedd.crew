"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ShooterBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="flex flex-col p-4">
      <Link
        href="/weddings"
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Weddings
      </Link>
      <div className="flex flex-1 items-center justify-center py-16 text-center">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Brief View</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The wedding brief will appear here.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Wedding ID: {id}
          </p>
        </div>
      </div>
    </div>
  );
}

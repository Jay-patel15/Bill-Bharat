import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function EmptyState({ title, description, actionHref, actionLabel }) {
  return (
    <Card>
      <CardContent className="p-10 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground mt-1">{description}</p> : null}
        {actionHref ? (
          <Link href={actionHref}><Button className="mt-4">{actionLabel}</Button></Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function NoCompanySelected() {
  return (
    <EmptyState
      title="No company selected"
      description="Create or select a company from the top-bar to continue."
      actionHref="/companies/create"
      actionLabel="Create a company"
    />
  );
}

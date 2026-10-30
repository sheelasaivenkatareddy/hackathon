import { Button, EmptyState } from "../components/ui";
import { LeafIllustration } from "../components/viz";

export default function NotFound() {
  return (
    <div className="wrap py-12">
      <EmptyState title="This page was not found" illustration={<LeafIllustration className="h-32 w-28" title="" />}>
        <Button to="/">Go home</Button>
      </EmptyState>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

export default function Contact() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <Button variant="ghost" asChild><Link to="/">Back</Link></Button>
      </header>
      <section className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight">Talk to us.</h1>
        <p className="mt-3 text-muted-foreground">Tell us about your business and we'll be in touch.</p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            toast({ title: "Message sent", description: "We'll respond within one business day." });
            (e.target as HTMLFormElement).reset();
          }}
        >
          <div><Label htmlFor="name">Name</Label><Input id="name" required /></div>
          <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required /></div>
          <div><Label htmlFor="message">Message</Label><Textarea id="message" rows={5} required /></div>
          <Button type="submit" className="w-full">Send</Button>
        </form>
      </section>
    </div>
  );
}

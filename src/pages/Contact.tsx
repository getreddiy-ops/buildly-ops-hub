import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { useState } from "react";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Contact — FastTract" description="Talk to the FastTract team about bringing a personal AI assistant into your business." path="/contact" />
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
            const subject = encodeURIComponent(`FastTract inquiry from ${name}`);
            const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
            window.location.href = `mailto:getreddiy@gmail.com?subject=${subject}&body=${body}`;
            toast({ title: "Email draft opened", description: "Review the message in your email app, then send it when ready." });
          }}
        >
          <div><Label htmlFor="name">Name</Label><Input id="name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label htmlFor="message">Message</Label><Textarea id="message" rows={5} required value={message} onChange={(e) => setMessage(e.target.value)} /></div>
          <Button type="submit" className="w-full">Open email draft</Button>
          <p className="text-center text-xs text-muted-foreground">Your email app will open. Nothing is sent until you approve it there.</p>
        </form>
      </section>
    </div>
  );
}

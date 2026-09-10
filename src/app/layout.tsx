import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Spotify AI Support Agent - Production Triage & RAG System',
  description: 'AI Customer Support Agent specialized for @SpotifyCares using Groq, Gemini, and pgvector RAG.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

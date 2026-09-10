export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Spotify AI Support Agent</h1>
      <p>tRPC API endpoints are active at <code>/api/trpc</code>.</p>
      <p>Procedures available: <code>classify</code>, <code>retrieve</code>, <code>draftReply</code>, <code>escalate</code>.</p>
    </main>
  );
}

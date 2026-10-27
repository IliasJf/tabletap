import QrPanel from "../components/QrPanel";
export default function QrPage() {
  return (
    <main className="qr-page">
      <a className="back-link" href="/">
        ← Back to the café
      </a>
      <h1>A seat at your table.</h1>
      <p className="qr-intro">
        Create a QR menu for the demo, or sign in to the owner dashboard to make
        one for your restaurant.
      </p>
      <QrPanel />
      <a className="text-link" href="/admin">
        Open owner dashboard →
      </a>
    </main>
  );
}

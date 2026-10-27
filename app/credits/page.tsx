const photos = [
  ["Avocado toast", "Fer Martinez Gonzalez", "8335330"],
  ["Shakshuka", "Anya Dunes", "36249730"],
  ["Harvest bowl", "Alesia Kozik", "6546437"],
  ["Pancakes", "Viktor Mogilat", "3977340"],
  ["Coffee", "Shameel mukkath", "11160115"],
  ["Croissant", "Lisa Fotios", "16543194"],
  ["Salad", "Karl Solano", "7282789"],
  ["Café interior", "Enes Beydilli", "29517899"],
  ["Iced latte", "Blanca Isela", "35240179"],
  ["Mint tea", "Redouan Charf", "10805330"],
  ["Cheesecake", "Suzy Hazelwood", "7227435"],
  ["Orange cake", "Eva", "12261129"],
];
export default function Credits() {
  return (
    <main className="credits-page">
      <a className="back-link" href="/">
        ← Back to the café
      </a>
      <h1>Good pictures. Good people.</h1>
      <p>
        Olive & Ember is a fictional café created for the TableTap portfolio
        project. These stock photographs illustrate the sample menu and café
        atmosphere.
      </p>
      <h2>Photography</h2>
      <ul>
        {photos.map(([subject, name, id]) => (
          <li key={id}>
            {subject} — {name},{" "}
            <a
              href={`https://www.pexels.com/photo/${id}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Pexels
            </a>
          </li>
        ))}
      </ul>
      <p>
        Photos are used under the{" "}
        <a href="https://www.pexels.com/license/">Pexels License</a>. No
        endorsement is implied.
      </p>
      <h2>Type & icons</h2>
      <p>
        DM Sans and Cormorant Garamond are licensed under the SIL Open Font
        License. Icons by Lucide, licensed under ISC.
      </p>
      <a className="text-link" href="/">
        Return to the menu →
      </a>
    </main>
  );
}

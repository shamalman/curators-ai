import './globals.css'

export const metadata = {
  title: 'Curators',
  description: 'Your personal AI for recommendations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

import './globals.css'

export const metadata = {
  title: 'Curators',
  description: 'Your personal AI for recommendations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,300;1,6..72,400&family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}

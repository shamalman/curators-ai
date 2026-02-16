export async function POST(request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return Response.json({ error: 'URL required' }, { status: 400 });
    }

    let metadata = { title: null, source: null };

    // Spotify
    if (url.includes('spotify.com')) {
      metadata.source = 'Spotify';
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
      const res = await fetch(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        metadata.title = data.title;
      }
    }
    
    // YouTube
    else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      metadata.source = 'YouTube';
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const res = await fetch(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        metadata.title = data.title;
      }
    }
    
    // Wikipedia
    else if (url.includes('wikipedia.org')) {
      metadata.source = 'Wikipedia';
      const match = url.match(/\/wiki\/([^#?]+)/);
      if (match) {
        metadata.title = decodeURIComponent(match[1].replace(/_/g, ' '));
      }
    }
    
    // Generic website
    else {
      metadata.source = 'Website';
      try {
        const res = await fetch(url, { 
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CuratorsBot/1.0)' }
        });
        if (res.ok) {
          const html = await res.text();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            metadata.title = titleMatch[1].trim();
          }
        }
      } catch (e) {
        // Couldn't fetch
      }
    }

    return Response.json(metadata);
  } catch (error) {
    console.error('Link metadata error:', error);
    return Response.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}

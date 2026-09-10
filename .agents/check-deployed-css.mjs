async function check() {
  try {
    const res = await fetch('https://turbo-start-sanity-web-olxq.vercel.app/');
    const html = await res.text();
    const match = html.match(/href="(\/_next\/static\/chunks\/[^"]+\.css)"/);
    console.log('CSS URL:', match ? match[1] : 'No CSS found in HTML');
    if (match) {
      const cssRes = await fetch('https://turbo-start-sanity-web-olxq.vercel.app' + match[1]);
      const css = await cssRes.text();
      console.log('CSS Size:', css.length, 'bytes');
      console.log('Contains .flex?', css.includes('.flex'));
      console.log('Contains .container?', css.includes('.container'));
      console.log('Contains .grid-cols-3?', css.includes('grid-cols-3') || css.includes('lg\\:grid-cols-3'));
      console.log('Contains sm:flex-row?', css.includes('sm\\:flex-row') || css.includes('sm:flex-row'));
    }
  } catch (e) {
    console.error(e);
  }
}
check();
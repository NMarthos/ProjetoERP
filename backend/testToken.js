async function test() {
    const res = await fetch('http://localhost:3001/api/public/proposals/30/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'LBDSFA' })
    });
    console.log(res.status);
    const text = await res.text();
    console.log(text);
}

test();

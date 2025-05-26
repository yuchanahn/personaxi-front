export async function loadContent() {
    const res = await fetch('http://localhost:8080/api/contents', {
        credentials: 'include'
    });
    if (res.ok) {
        const data = await res.json();
        return data;
    }
    return [];
}
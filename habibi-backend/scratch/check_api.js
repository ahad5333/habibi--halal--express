async function run() {
  try {
    const res = await fetch("http://localhost:5001/api/menus");
    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }
    const data = await res.json();
    console.log("Backend response status: OK");
    console.log(`Menus returned: ${data.length} items`);
    if (data.length > 0) {
      console.log("First item:", data[0]);
    }
  } catch (e) {
    console.error("Failed to connect to backend:", e.message);
  }
}

run();

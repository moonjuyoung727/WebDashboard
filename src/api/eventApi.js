export async function getEvents() {
  const response = await fetch("/api/events");

  if (!response.ok) {
    throw new Error("이벤트 조회 실패");
  }

  return response.json();
}

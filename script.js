const ANSWERS = [
  "Sí, definitivamente",
  "Es cierto",
  "Sin duda alguna",
  "Sí, puedes confiar en ello",
  "Todo apunta a que sí",
  "Las señales dicen que sí",
  "Muy probable",
  "Buenas perspectivas",
  "Pregunta de nuevo más tarde",
  "Mejor no te lo digo ahora",
  "No puedo predecirlo ahora",
  "Concéntrate y pregunta otra vez",
  "No cuentes con ello",
  "Mi respuesta es no",
  "Mis fuentes dicen que no",
  "Las perspectivas no son buenas",
  "Muy dudoso",
];

const ball = document.getElementById("ball");
const answerEl = document.getElementById("answer");
const questionInput = document.getElementById("question");
const askButton = document.getElementById("askButton");

function ask() {
  if (!questionInput.value.trim()) {
    questionInput.focus();
    return;
  }

  askButton.disabled = true;
  ball.classList.add("shaking");
  answerEl.textContent = "...";

  setTimeout(() => {
    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    answerEl.textContent = answer;
    ball.classList.remove("shaking");
    askButton.disabled = false;
  }, 700);
}

askButton.addEventListener("click", ask);
questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    ask();
  }
});

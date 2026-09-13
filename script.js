const ANSWERS = [
  "Sí, sin ninguna duda",
  "Las estrellas lo confirman",
  "Cuenta con ello",
  "El camino está despejado",
  "Todo apunta a que sí",
  "Es un buen presagio",
  "Muy probable",
  "Las señales son favorables",
  "Pregunta de nuevo cuando la luna cambie",
  "El oráculo guarda silencio por ahora",
  "Aún no está escrito",
  "Concéntrate y vuelve a preguntar",
  "No cuentes con ello",
  "Las cartas dicen que no",
  "Los astros lo desaconsejan",
  "El presagio no es bueno",
  "Muy dudoso",
];

const form = document.getElementById("oracleForm");
const ball = document.getElementById("ball");
const answerEl = document.getElementById("answer");
const questionInput = document.getElementById("question");
const askButton = document.getElementById("askButton");

form.addEventListener("submit", (event) => {
  event.preventDefault();

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
});

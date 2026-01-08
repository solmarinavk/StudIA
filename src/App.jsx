import { useState, useEffect } from 'react'
import './App.css'

// Utility functions
const gcd = (a, b) => b === 0 ? Math.abs(a) : gcd(b, a % b)

const simplifyFraction = (num, den) => {
  const divisor = gcd(num, den)
  return { num: num / divisor, den: den / divisor }
}

const generateFraction = (level) => {
  const maxNum = Math.min(10 + level * 2, 20)
  const num = Math.floor(Math.random() * maxNum) + 1
  const den = Math.floor(Math.random() * maxNum) + 1
  return { num, den }
}

const operations = [
  { name: 'Sumar', symbol: '+', emoji: '➕' },
  { name: 'Restar', symbol: '-', emoji: '➖' },
  { name: 'Multiplicar', symbol: '×', emoji: '✖️' },
  { name: 'Dividir', symbol: '÷', emoji: '➗' },
  { name: 'Simplificar', symbol: '=', emoji: '🔽' }
]

function App() {
  const [gameState, setGameState] = useState('menu') // menu, playing, result
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [userAnswer, setUserAnswer] = useState({ num: '', den: '' })
  const [feedback, setFeedback] = useState(null)
  const [streak, setStreak] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)

  const generateQuestion = () => {
    const operationType = Math.floor(Math.random() * operations.length)
    const operation = operations[operationType]

    const frac1 = generateFraction(level)
    const frac2 = generateFraction(level)

    let correctAnswer = { num: 0, den: 1 }

    switch(operation.symbol) {
      case '+':
        correctAnswer.num = frac1.num * frac2.den + frac2.num * frac1.den
        correctAnswer.den = frac1.den * frac2.den
        break
      case '-':
        correctAnswer.num = frac1.num * frac2.den - frac2.num * frac1.den
        correctAnswer.den = frac1.den * frac2.den
        break
      case '×':
        correctAnswer.num = frac1.num * frac2.num
        correctAnswer.den = frac1.den * frac2.den
        break
      case '÷':
        correctAnswer.num = frac1.num * frac2.den
        correctAnswer.den = frac1.den * frac2.num
        break
      case '=':
        correctAnswer = simplifyFraction(frac1.num, frac1.den)
        break
    }

    correctAnswer = simplifyFraction(correctAnswer.num, correctAnswer.den)

    setCurrentQuestion({
      frac1,
      frac2: operation.symbol === '=' ? null : frac2,
      operation,
      correctAnswer
    })

    setUserAnswer({ num: '', den: '' })
    setFeedback(null)
  }

  const startGame = () => {
    setGameState('playing')
    setScore(0)
    setLives(3)
    setLevel(1)
    setStreak(0)
    setTotalQuestions(0)
    generateQuestion()
  }

  const checkAnswer = () => {
    const numAnswer = parseInt(userAnswer.num)
    const denAnswer = parseInt(userAnswer.den)

    if (isNaN(numAnswer) || isNaN(denAnswer) || denAnswer === 0) {
      setFeedback({ correct: false, message: '¡Ingresa una fracción válida!' })
      return
    }

    const simplified = simplifyFraction(numAnswer, denAnswer)
    const correct = simplified.num === currentQuestion.correctAnswer.num &&
                   simplified.den === currentQuestion.correctAnswer.den

    setTotalQuestions(prev => prev + 1)

    if (correct) {
      const points = 10 * level * (streak + 1)
      setScore(prev => prev + points)
      setStreak(prev => prev + 1)
      setFeedback({
        correct: true,
        message: `¡Correcto! +${points} puntos`,
        emoji: streak >= 2 ? '🔥' : '✨'
      })

      if ((totalQuestions + 1) % 5 === 0) {
        setLevel(prev => prev + 1)
        setFeedback({
          correct: true,
          message: `¡Nivel ${level + 1} desbloqueado! +${points} puntos`,
          emoji: '🎉'
        })
      }

      setTimeout(() => generateQuestion(), 1500)
    } else {
      setLives(prev => prev - 1)
      setStreak(0)
      setFeedback({
        correct: false,
        message: `Incorrecto. La respuesta era ${currentQuestion.correctAnswer.num}/${currentQuestion.correctAnswer.den}`,
        emoji: '❌'
      })

      if (lives <= 1) {
        setTimeout(() => setGameState('result'), 2000)
      } else {
        setTimeout(() => generateQuestion(), 2500)
      }
    }
  }

  const Fraction = ({ num, den, label }) => (
    <div className="fraction-display">
      {label && <div className="fraction-label">{label}</div>}
      <div className="fraction">
        <div className="numerator">{num}</div>
        <div className="fraction-line"></div>
        <div className="denominator">{den}</div>
      </div>
    </div>
  )

  if (gameState === 'menu') {
    return (
      <div className="container">
        <div className="menu">
          <h1 className="title">🎮 Fracciones Game</h1>
          <p className="subtitle">¡Aprende matemáticas jugando!</p>

          <div className="game-info">
            <div className="info-card">
              <span className="info-emoji">🎯</span>
              <p>Resuelve operaciones con fracciones</p>
            </div>
            <div className="info-card">
              <span className="info-emoji">⭐</span>
              <p>Gana puntos y sube de nivel</p>
            </div>
            <div className="info-card">
              <span className="info-emoji">❤️</span>
              <p>Tienes 3 vidas por partida</p>
            </div>
          </div>

          <button className="btn-primary" onClick={startGame}>
            Comenzar a Jugar
          </button>

          <div className="operations-list">
            <h3>Operaciones disponibles:</h3>
            <div className="operations-grid">
              {operations.map((op, i) => (
                <div key={i} className="operation-badge">
                  <span>{op.emoji}</span> {op.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'result') {
    const accuracy = totalQuestions > 0 ? ((score / (totalQuestions * 10)) * 100).toFixed(1) : 0

    return (
      <div className="container">
        <div className="result">
          <h1 className="result-title">🎮 Fin del Juego</h1>

          <div className="result-stats">
            <div className="stat-card">
              <span className="stat-emoji">⭐</span>
              <div className="stat-value">{score}</div>
              <div className="stat-label">Puntos</div>
            </div>
            <div className="stat-card">
              <span className="stat-emoji">📊</span>
              <div className="stat-value">{level}</div>
              <div className="stat-label">Nivel alcanzado</div>
            </div>
            <div className="stat-card">
              <span className="stat-emoji">✅</span>
              <div className="stat-value">{totalQuestions}</div>
              <div className="stat-label">Preguntas</div>
            </div>
          </div>

          <div className="accuracy">
            <p>Precisión: {accuracy}%</p>
          </div>

          <button className="btn-primary" onClick={startGame}>
            Jugar de Nuevo
          </button>

          <button className="btn-secondary" onClick={() => setGameState('menu')}>
            Volver al Menú
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="game">
        <div className="game-header">
          <div className="game-stats">
            <div className="stat">
              <span className="stat-icon">⭐</span>
              <span className="stat-text">{score}</span>
            </div>
            <div className="stat">
              <span className="stat-icon">🎯</span>
              <span className="stat-text">Nivel {level}</span>
            </div>
            <div className="stat">
              <span className="stat-icon">❤️</span>
              <span className="stat-text">{'❤️'.repeat(lives)}</span>
            </div>
          </div>

          {streak >= 3 && (
            <div className="streak-badge">
              🔥 Racha x{streak}
            </div>
          )}
        </div>

        {currentQuestion && (
          <div className="question-area">
            <h2 className="question-title">
              {currentQuestion.operation.emoji} {currentQuestion.operation.name} las fracciones
            </h2>

            <div className="fractions-container">
              <Fraction num={currentQuestion.frac1.num} den={currentQuestion.frac1.den} />

              {currentQuestion.frac2 && (
                <>
                  <div className="operation-symbol">{currentQuestion.operation.symbol}</div>
                  <Fraction num={currentQuestion.frac2.num} den={currentQuestion.frac2.den} />
                </>
              )}

              <div className="operation-symbol">=</div>

              <div className="fraction-display">
                <div className="fraction answer-fraction">
                  <input
                    type="number"
                    className="fraction-input numerator-input"
                    value={userAnswer.num}
                    onChange={(e) => setUserAnswer(prev => ({ ...prev, num: e.target.value }))}
                    placeholder="?"
                    disabled={feedback !== null}
                  />
                  <div className="fraction-line"></div>
                  <input
                    type="number"
                    className="fraction-input denominator-input"
                    value={userAnswer.den}
                    onChange={(e) => setUserAnswer(prev => ({ ...prev, den: e.target.value }))}
                    placeholder="?"
                    disabled={feedback !== null}
                  />
                </div>
              </div>
            </div>

            {!feedback && (
              <button
                className="btn-primary btn-check"
                onClick={checkAnswer}
                disabled={!userAnswer.num || !userAnswer.den}
              >
                Verificar Respuesta
              </button>
            )}

            {feedback && (
              <div className={`feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
                <span className="feedback-emoji">{feedback.emoji}</span>
                <p>{feedback.message}</p>
              </div>
            )}
          </div>
        )}

        <div className="hint">
          💡 Recuerda simplificar tu respuesta
        </div>
      </div>
    </div>
  )
}

export default App

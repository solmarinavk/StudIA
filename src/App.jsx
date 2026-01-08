import { useState } from 'react'
import './App.css'

// Utility functions
const gcd = (a, b) => b === 0 ? Math.abs(a) : gcd(b, a % b)

const simplifyFraction = (num, den) => {
  if (den === 0) return { num: 0, den: 1 }
  const divisor = gcd(num, den)
  return { num: num / divisor, den: den / divisor }
}

const generateFraction = (difficulty) => {
  let maxNum = 5
  let minNum = 1

  if (difficulty === 'intermedio') {
    maxNum = 10
    minNum = 1
  } else if (difficulty === 'experto') {
    maxNum = 20
    minNum = 1
  }

  const num = Math.floor(Math.random() * maxNum) + minNum
  const den = Math.floor(Math.random() * maxNum) + minNum
  return { num, den }
}

const operations = [
  {
    name: 'Sumar',
    symbol: '+',
    emoji: '➕',
    tutorial: 'Para sumar fracciones:\n1. Multiplica el numerador de cada fracción por el denominador de la otra\n2. Suma los resultados\n3. El denominador es la multiplicación de ambos denominadores\n4. Simplifica el resultado'
  },
  {
    name: 'Restar',
    symbol: '-',
    emoji: '➖',
    tutorial: 'Para restar fracciones:\n1. Multiplica el numerador de cada fracción por el denominador de la otra\n2. Resta el segundo resultado del primero\n3. El denominador es la multiplicación de ambos denominadores\n4. Simplifica el resultado'
  },
  {
    name: 'Multiplicar',
    symbol: '×',
    emoji: '✖️',
    tutorial: 'Para multiplicar fracciones (¡es la más fácil!):\n1. Multiplica numerador con numerador\n2. Multiplica denominador con denominador\n3. Simplifica el resultado'
  },
  {
    name: 'Dividir',
    symbol: '÷',
    emoji: '➗',
    tutorial: 'Para dividir fracciones:\n1. Dale la vuelta a la segunda fracción (invierte)\n2. Ahora multiplícalas (numerador × numerador, denominador × denominador)\n3. Simplifica el resultado'
  },
  {
    name: 'Simplificar',
    symbol: '=',
    emoji: '🔽',
    tutorial: 'Para simplificar fracciones:\n1. Encuentra el máximo común divisor (MCD) del numerador y denominador\n2. Divide ambos números por el MCD\n3. Si el MCD es 1, la fracción ya está simplificada'
  }
]

function App() {
  const [gameState, setGameState] = useState('menu')
  const [difficulty, setDifficulty] = useState('principiante')
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [userAnswer, setUserAnswer] = useState({ num: '', den: '' })
  const [feedback, setFeedback] = useState(null)
  const [streak, setStreak] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [practiceMode, setPracticeMode] = useState(null)

  const generateQuestion = (operationType = null) => {
    let operation
    if (practiceMode !== null) {
      operation = operations[practiceMode]
    } else if (operationType !== null) {
      operation = operations[operationType]
    } else {
      const opIndex = Math.floor(Math.random() * operations.length)
      operation = operations[opIndex]
    }

    const frac1 = generateFraction(difficulty)
    const frac2 = generateFraction(difficulty)

    let correctAnswer = { num: 0, den: 1 }
    let steps = []

    switch(operation.symbol) {
      case '+':
        steps = [
          `Paso 1: ${frac1.num}/${frac1.den} + ${frac2.num}/${frac2.den}`,
          `Paso 2: (${frac1.num} × ${frac2.den}) + (${frac2.num} × ${frac1.den}) = ${frac1.num * frac2.den} + ${frac2.num * frac1.den} = ${frac1.num * frac2.den + frac2.num * frac1.den}`,
          `Paso 3: Denominador: ${frac1.den} × ${frac2.den} = ${frac1.den * frac2.den}`,
          `Paso 4: Resultado sin simplificar: ${frac1.num * frac2.den + frac2.num * frac1.den}/${frac1.den * frac2.den}`
        ]
        correctAnswer.num = frac1.num * frac2.den + frac2.num * frac1.den
        correctAnswer.den = frac1.den * frac2.den
        break
      case '-':
        steps = [
          `Paso 1: ${frac1.num}/${frac1.den} - ${frac2.num}/${frac2.den}`,
          `Paso 2: (${frac1.num} × ${frac2.den}) - (${frac2.num} × ${frac1.den}) = ${frac1.num * frac2.den} - ${frac2.num * frac1.den} = ${frac1.num * frac2.den - frac2.num * frac1.den}`,
          `Paso 3: Denominador: ${frac1.den} × ${frac2.den} = ${frac1.den * frac2.den}`,
          `Paso 4: Resultado sin simplificar: ${frac1.num * frac2.den - frac2.num * frac1.den}/${frac1.den * frac2.den}`
        ]
        correctAnswer.num = frac1.num * frac2.den - frac2.num * frac1.den
        correctAnswer.den = frac1.den * frac2.den
        break
      case '×':
        steps = [
          `Paso 1: ${frac1.num}/${frac1.den} × ${frac2.num}/${frac2.den}`,
          `Paso 2: Multiplica numeradores: ${frac1.num} × ${frac2.num} = ${frac1.num * frac2.num}`,
          `Paso 3: Multiplica denominadores: ${frac1.den} × ${frac2.den} = ${frac1.den * frac2.den}`,
          `Paso 4: Resultado sin simplificar: ${frac1.num * frac2.num}/${frac1.den * frac2.den}`
        ]
        correctAnswer.num = frac1.num * frac2.num
        correctAnswer.den = frac1.den * frac2.den
        break
      case '÷':
        steps = [
          `Paso 1: ${frac1.num}/${frac1.den} ÷ ${frac2.num}/${frac2.den}`,
          `Paso 2: Invierte la segunda fracción: ${frac2.den}/${frac2.num}`,
          `Paso 3: Ahora multiplica: ${frac1.num} × ${frac2.den} = ${frac1.num * frac2.den}`,
          `Paso 4: Denominador: ${frac1.den} × ${frac2.num} = ${frac1.den * frac2.num}`,
          `Paso 5: Resultado sin simplificar: ${frac1.num * frac2.den}/${frac1.den * frac2.num}`
        ]
        correctAnswer.num = frac1.num * frac2.den
        correctAnswer.den = frac1.den * frac2.num
        break
      case '=':
        const originalDivisor = gcd(frac1.num, frac1.den)
        steps = [
          `Paso 1: Simplificar ${frac1.num}/${frac1.den}`,
          `Paso 2: Encuentra el MCD de ${frac1.num} y ${frac1.den}`,
          `Paso 3: El MCD es ${originalDivisor}`,
          `Paso 4: Divide ambos: ${frac1.num}÷${originalDivisor} = ${frac1.num/originalDivisor}, ${frac1.den}÷${originalDivisor} = ${frac1.den/originalDivisor}`,
          `Paso 5: Resultado simplificado: ${frac1.num/originalDivisor}/${frac1.den/originalDivisor}`
        ]
        correctAnswer = simplifyFraction(frac1.num, frac1.den)
        break
    }

    const beforeSimplify = { ...correctAnswer }
    correctAnswer = simplifyFraction(correctAnswer.num, correctAnswer.den)

    if (beforeSimplify.num !== correctAnswer.num || beforeSimplify.den !== correctAnswer.den) {
      steps.push(`Paso final: Simplificado = ${correctAnswer.num}/${correctAnswer.den}`)
    } else {
      steps.push(`Paso final: Ya está simplificado = ${correctAnswer.num}/${correctAnswer.den}`)
    }

    setCurrentQuestion({
      frac1,
      frac2: operation.symbol === '=' ? null : frac2,
      operation,
      correctAnswer,
      steps
    })

    setUserAnswer({ num: '', den: '' })
    setFeedback(null)
    setShowHelp(false)
  }

  const startGame = (diff) => {
    setDifficulty(diff)
    setGameState('playing')
    setScore(0)
    setLives(3)
    setLevel(1)
    setStreak(0)
    setTotalQuestions(0)
    setPracticeMode(null)
    generateQuestion()
  }

  const startTutorial = () => {
    setGameState('tutorial')
    setTutorialStep(0)
  }

  const startPractice = (operationIndex) => {
    setPracticeMode(operationIndex)
    setGameState('playing')
    setScore(0)
    setLives(3)
    setLevel(1)
    setStreak(0)
    setTotalQuestions(0)
    generateQuestion(operationIndex)
  }

  const checkAnswer = () => {
    const numAnswer = parseInt(userAnswer.num)
    const denAnswer = parseInt(userAnswer.den)

    if (isNaN(numAnswer) || isNaN(denAnswer) || denAnswer === 0) {
      setFeedback({ correct: false, message: '¡Ingresa una fracción válida!', emoji: '⚠️' })
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

      if ((totalQuestions + 1) % 5 === 0 && practiceMode === null) {
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

  const Fraction = ({ num, den, label, visual = false }) => (
    <div className="fraction-display">
      {label && <div className="fraction-label">{label}</div>}
      <div className="fraction">
        <div className="numerator">{num}</div>
        <div className="fraction-line"></div>
        <div className="denominator">{den}</div>
      </div>
      {visual && (
        <div className="fraction-visual">
          <div className="visual-parts">
            {[...Array(Math.min(den, 10))].map((_, i) => (
              <div
                key={i}
                className={`visual-part ${i < num ? 'filled' : ''}`}
                style={{ width: `${90 / Math.min(den, 10)}%` }}
              />
            ))}
          </div>
          <div className="visual-label">{num} de {den} partes</div>
        </div>
      )}
    </div>
  )

  if (gameState === 'menu') {
    return (
      <div className="container">
        <div className="menu">
          <h1 className="title">🎮 Fracciones Game</h1>
          <p className="subtitle">¡Aprende matemáticas paso a paso!</p>

          <div className="game-info">
            <div className="info-card">
              <span className="info-emoji">📚</span>
              <p>Aprende con tutoriales paso a paso</p>
            </div>
            <div className="info-card">
              <span className="info-emoji">🎯</span>
              <p>Practica cada operación por separado</p>
            </div>
            <div className="info-card">
              <span className="info-emoji">💡</span>
              <p>Obtén ayuda cuando la necesites</p>
            </div>
          </div>

          <button className="btn-primary" onClick={startTutorial}>
            📖 Comenzar Tutorial
          </button>

          <div className="difficulty-section">
            <h3>O juega directamente:</h3>
            <div className="difficulty-buttons">
              <button className="btn-difficulty easy" onClick={() => startGame('principiante')}>
                🌱 Principiante
                <span className="diff-desc">Números 1-5</span>
              </button>
              <button className="btn-difficulty medium" onClick={() => startGame('intermedio')}>
                🌟 Intermedio
                <span className="diff-desc">Números 1-10</span>
              </button>
              <button className="btn-difficulty hard" onClick={() => startGame('experto')}>
                🔥 Experto
                <span className="diff-desc">Números 1-20</span>
              </button>
            </div>
          </div>

          <div className="operations-list">
            <h3>Practica operaciones específicas:</h3>
            <div className="operations-grid">
              {operations.map((op, i) => (
                <button
                  key={i}
                  className="operation-badge clickable"
                  onClick={() => startPractice(i)}
                >
                  <span>{op.emoji}</span> {op.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'tutorial') {
    const currentOp = operations[tutorialStep]

    return (
      <div className="container">
        <div className="tutorial">
          <h1 className="tutorial-title">
            {currentOp.emoji} Cómo {currentOp.name} Fracciones
          </h1>

          <div className="tutorial-content">
            <div className="tutorial-explanation">
              <pre>{currentOp.tutorial}</pre>
            </div>

            <div className="tutorial-example">
              <h3>Ejemplo:</h3>
              {currentOp.symbol === '=' ? (
                <>
                  <div className="example-problem">
                    <Fraction num={6} den={8} visual={true} />
                    <div className="operation-symbol">=</div>
                    <Fraction num={3} den={4} visual={true} />
                  </div>
                  <div className="example-steps">
                    <p>6 y 8 se pueden dividir por 2</p>
                    <p>6 ÷ 2 = 3</p>
                    <p>8 ÷ 2 = 4</p>
                    <p>¡Resultado: 3/4!</p>
                  </div>
                </>
              ) : currentOp.symbol === '+' ? (
                <>
                  <div className="example-problem">
                    <Fraction num={1} den={2} visual={true} />
                    <div className="operation-symbol">+</div>
                    <Fraction num={1} den={4} visual={true} />
                    <div className="operation-symbol">=</div>
                    <Fraction num={3} den={4} visual={true} />
                  </div>
                  <div className="example-steps">
                    <p>(1 × 4) + (1 × 2) = 4 + 2 = 6</p>
                    <p>2 × 4 = 8</p>
                    <p>6/8 = 3/4 (simplificado)</p>
                  </div>
                </>
              ) : currentOp.symbol === '×' ? (
                <>
                  <div className="example-problem">
                    <Fraction num={2} den={3} visual={true} />
                    <div className="operation-symbol">×</div>
                    <Fraction num={3} den={4} visual={true} />
                    <div className="operation-symbol">=</div>
                    <Fraction num={1} den={2} visual={true} />
                  </div>
                  <div className="example-steps">
                    <p>2 × 3 = 6</p>
                    <p>3 × 4 = 12</p>
                    <p>6/12 = 1/2 (simplificado)</p>
                  </div>
                </>
              ) : currentOp.symbol === '÷' ? (
                <>
                  <div className="example-problem">
                    <Fraction num={1} den={2} visual={true} />
                    <div className="operation-symbol">÷</div>
                    <Fraction num={1} den={4} visual={true} />
                    <div className="operation-symbol">=</div>
                    <Fraction num={2} den={1} visual={true} />
                  </div>
                  <div className="example-steps">
                    <p>Invierte 1/4 → 4/1</p>
                    <p>1 × 4 = 4</p>
                    <p>2 × 1 = 2</p>
                    <p>4/2 = 2/1 = 2</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="example-problem">
                    <Fraction num={2} den={3} visual={true} />
                    <div className="operation-symbol">-</div>
                    <Fraction num={1} den={4} visual={true} />
                    <div className="operation-symbol">=</div>
                    <Fraction num={5} den={12} visual={true} />
                  </div>
                  <div className="example-steps">
                    <p>(2 × 4) - (1 × 3) = 8 - 3 = 5</p>
                    <p>3 × 4 = 12</p>
                    <p>¡Resultado: 5/12!</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="tutorial-nav">
            {tutorialStep > 0 && (
              <button className="btn-secondary" onClick={() => setTutorialStep(prev => prev - 1)}>
                ← Anterior
              </button>
            )}

            {tutorialStep < operations.length - 1 ? (
              <button className="btn-primary" onClick={() => setTutorialStep(prev => prev + 1)}>
                Siguiente →
              </button>
            ) : (
              <button className="btn-primary" onClick={() => setGameState('menu')}>
                ¡Listo para Jugar! 🎮
              </button>
            )}
          </div>

          <button className="btn-skip" onClick={() => setGameState('menu')}>
            Saltar Tutorial
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'result') {
    const accuracy = totalQuestions > 0 ? ((score / (totalQuestions * 10 * level)) * 100).toFixed(1) : 0

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

          <button className="btn-primary" onClick={() => startGame(difficulty)}>
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
            {practiceMode === null && (
              <div className="stat">
                <span className="stat-icon">🎯</span>
                <span className="stat-text">Nivel {level}</span>
              </div>
            )}
            {practiceMode !== null && (
              <div className="stat">
                <span className="stat-icon">📝</span>
                <span className="stat-text">Práctica</span>
              </div>
            )}
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
              <Fraction
                num={currentQuestion.frac1.num}
                den={currentQuestion.frac1.den}
                visual={difficulty === 'principiante'}
              />

              {currentQuestion.frac2 && (
                <>
                  <div className="operation-symbol">{currentQuestion.operation.symbol}</div>
                  <Fraction
                    num={currentQuestion.frac2.num}
                    den={currentQuestion.frac2.den}
                    visual={difficulty === 'principiante'}
                  />
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
              <div className="button-group">
                <button
                  className="btn-help"
                  onClick={() => setShowHelp(!showHelp)}
                >
                  💡 {showHelp ? 'Ocultar' : 'Ver'} Ayuda
                </button>
                <button
                  className="btn-primary btn-check"
                  onClick={checkAnswer}
                  disabled={!userAnswer.num || !userAnswer.den}
                >
                  Verificar Respuesta
                </button>
              </div>
            )}

            {showHelp && !feedback && (
              <div className="help-box">
                <h3>🔍 Solución paso a paso:</h3>
                <div className="steps">
                  {currentQuestion.steps.map((step, i) => (
                    <p key={i} className="step">{step}</p>
                  ))}
                </div>
              </div>
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
          💡 Usa el botón de ayuda si te quedas atascado
        </div>

        <button className="btn-exit" onClick={() => setGameState('menu')}>
          ← Volver al Menú
        </button>
      </div>
    </div>
  )
}

export default App

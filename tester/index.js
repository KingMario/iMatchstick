const http = require('http')
const readline = require('readline')
const fs = require('fs')
const ProgressBar = require('progress')
const colors = require('colors')
const difference = require('lodash').difference

const problemBasic = process.env.RADIO_2017_SH_PROBLEM !== 'bonus'
const host = process.env.RADIO_2017_SH_HOST || 'localhost'
const port = process.env.RADIO_2017_SH_PORT || 3000
const speedFactor = problemBasic ? (process.env.RADIO_2017_SH_SPEED_FACTOR || 10) : 1
const path = process.env.RADIO_2017_SH_PATH || '/radio-2017-sh/solve'
const url = `http://${host}:${port}${path}`

console.log('Testing for VMware Crashing Algorithm Competition 2017 Shanghai.'.blue,
  (problemBasic ? '' : '(Bonus Problem)'.red))
console.log(`Test endpoint: ${url}.`.magenta)
problemBasic && console.log(`Speed Factor: ${speedFactor} (the lower the faster).`.cyan.italic)

const total = problemBasic ? 2021 : 8

let correct = 0
let processed = 0

const errors = []
const bar = new ProgressBar(`Testing [:bar] :correct passed of :current `, {
  total,
  width: 50
})

const requestTimeout = problemBasic ? 3000 : 30000
const totalScore = problemBasic ? 60 : 40
const answerRegExp = /(\[\s*\])|(\[("\d{1,2}[+-]\d{1,2}=\d{1,3}")(,\s*"\d{1,2}[+-]\d{1,2}=\d{1,3}")*\])/

const rl = readline.createInterface({
  input: fs.createReadStream(problemBasic ? 'questions.txt' : 'bonusQuestions.txt')
})

rl.on('line', (line) => {
  processed++

  let [q, s, a] = line.split(' ')
  problemBasic && (a = s, s = 1)
  setTimeout(() => http.get(`${url}?q=${encodeURIComponent(q)}&s=${s}`, res => {
    let answer = ''

    res.on('data', chunk => answer += chunk)

    res.on('end', () => {
      if (answerRegExp.test(answer)) {
        let aArray = JSON.parse(a)
        let answerArray = JSON.parse(answer)
        let missedAnswers = difference(aArray, answerArray)
        let wrongAnswers = difference(answerArray, aArray)
        if (missedAnswers.length + wrongAnswers.length === 0) {
          correct++
        } else {
          errors.push(`Puzzle ${q} expects answer ${a}, but got ${answer}.` + 
            (missedAnswers.length ? '\n' + `  Missed answers: ${missedAnswers}` : '') +
            (wrongAnswers.length ? '\n' + `  Wrong answers: ${wrongAnswers}` : ''))
        }
      } else {
        errors.push(`Puzzle ${q} expects answer ${a}, but got ${answer}.`.red)
      }

      bar.tick({
        correct
      })
      if (bar.complete) {
        const correctRate = correct === total ? '100' : (correct / total * 100).toFixed(2)
        const crScore = correctRate * totalScore / 100
        const speedScore = parseFloat((20 / speedFactor).toFixed(2))
        if (errors.length) {
          console.log(errors.join('\n').red)
        }
        console.log(`Test finished. The correct rate is ${correctRate}%.`.blue)
        console.log(`Correct rate score: ${crScore}.`.blue)
        problemBasic && console.log(`Speed score: 20 / ${speedFactor} = ${speedScore}.`.blue)
        problemBasic && console.log(`Total score: ${crScore + speedScore}.`.red)
      }
    })
  }).setTimeout(requestTimeout, () => {
    console.log('Wait for the response timed out in 30 seconds.'.red)
    process.exit(1)
  }), speedFactor * processed)
})

const sticks = {
  0: '1111110',
  1: '0011000',
  2: '0110111',
  3: '0111101',
  4: '1011001',
  5: '1101101',
  6: '1101111',
  7: '0111000',
  8: '1111111',
  9: '1111101',
  '+': '1',
  '-': '0',
  '=': ''
}

let getSticks = function(q) {
  let qLength = q.length
  let qSticks = ''
  for (let i = 0; i < qLength; i++) {
    qSticks += sticks[q[i]]
  }
  return qSticks
}

let getS = function(a, b) {
  let sO = 0
  let sI = 0
  let aLength = a.length
  for (let i = 0; i < aLength; i++) {
    if (a[i] !== b[i]) {
      a[i] === '1' ? sO++ : sI++
    }
  }

  return sO === sI ? sO : -1
}

exports.solve = function(q, s) {
  let nums = q.split(/[+\-=]/)
  let opr = q.indexOf('+') > -1 ? '+' : '-'
  let qSticks = getSticks(q)

  let answer = []
  let qTest
  let aLength = nums[0].length
  let aThru = aLength === 1 ? 10 : 100
  let bLength = nums[1].length
  let bThru = bLength === 1 ? 10 : 100
  let cLength = nums[2].length

  let c
  for (let a = 0; a < aThru; a++) {
    for (let b = 0; b < bThru; b++) {
      c = a + b
      if (cLength >= c.toString().length) {
        let A = '0'.repeat(aLength - a.toString().length) + a.toString()
        let B = '0'.repeat(bLength - b.toString().length) + b.toString()
        let C = '0'.repeat(cLength - c.toString().length) + c.toString()
        qTest = A + '+' + B + '=' + C
        if (getS(qSticks, getSticks(qTest)) === s) {
          answer.push(qTest)
        }
      }

      c = a - b
      if (c >= 0 && cLength >= c.toString().length) {
        let A = '0'.repeat(aLength - a.toString().length) + a.toString()
        let B = '0'.repeat(bLength - b.toString().length) + b.toString()
        let C = '0'.repeat(cLength - c.toString().length) + c.toString()
        qTest = A + '-' + B + '=' + C
        if (getS(qSticks, getSticks(qTest)) === s) {
          answer.push(qTest)
        }
      }
    }
  }
  return answer
}

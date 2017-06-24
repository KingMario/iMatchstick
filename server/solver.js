const sticks = [
  0b1111110,
  0b0011000,
  0b0110111,
  0b0111101,
  0b1011001,
  0b1101101,
  0b1101111,
  0b0111000,
  0b1111111,
  0b1111101
]

const stickPositions = [
  0b1,
  0b10,
  0b100,
  0b1000,
  0b10000,
  0b100000,
  0b1000000
]

const added = {}
const removed = {}
const moved = {}

for (let i = 0; i < 10; i++) {
  for (let j = 0; j < 10; j++) {
    if (i !== j) {
      let x = sticks[i] ^ sticks[j]
      if (stickPositions.indexOf(x) > -1) {
        if (sticks[i] < sticks[j]) {
          added[i] = added[i] || []
          added[i].push(j)
          removed[j] = removed[j] || []
          removed[j].push(i)
        }
      } else {
        for (let k = 0; k < 7; k++) {
          let y = x - stickPositions[k]
          if (stickPositions.indexOf(y) > -1) {
            if (sticks[i] + x - 2 * y === sticks[j] ||
              sticks[i] - x + 2 * y === sticks[j]) {
              moved[i] = moved[i] || []
              moved[i].indexOf(j) === -1 && moved[i].push(j)
              break
            }
          }
        }
      }
    }
  }
}

added['-'] = ['+']
removed['+'] = ['-']

exports.solve = function (input) {
  let answer = []

  let checkEquation = function (equation) {
    let nums = equation.split(/[+\-=]/)
    return equation.indexOf('+') > -1 ? parseInt(nums[0]) + parseInt(nums[1]) === parseInt(nums[2])
      : parseInt(nums[0]) - parseInt(nums[1]) === parseInt(nums[2])
  }

  let qLength = input.length
  for (let i = 0; i < qLength; i++) {
    let iAdded = added[input[i]]
    if (iAdded) {
      let iAddedLength = iAdded.length
      for (let j = 0; j < iAddedLength; j++) {

        for (let k = 0; k < qLength; k++) {
          let kRemoved = removed[input[k]]
          if (i !== k && kRemoved) {
            let kRemovedLength = kRemoved.length 
            for (let l = 0; l < kRemovedLength; l++) {
              let transformedChars = input.split('')
              transformedChars.splice(i, 1, iAdded[j])
              transformedChars.splice(k, 1, kRemoved[l])
              let newEquation = transformedChars.join('')
              if (checkEquation(newEquation)) {
                answer.push(newEquation)
              }
            }
          }
        }
      }
    }
  }

  for (let i = 0; i < qLength; i++) {
    let iMoved = moved[input[i]]
    if (iMoved) {
      let iMovedLength = iMoved.length
      for (let j = 0; j < iMovedLength; j++) {
        let transformedChars = input.split('')
        transformedChars.splice(i, 1, iMoved[j])
        let newEquation = transformedChars.join('')
        if (checkEquation(newEquation)) {
          answer.push(newEquation)
        }
      }
    }
  }

  return answer
}

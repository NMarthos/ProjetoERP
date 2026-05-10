
const fs = require('fs');
const content = fs.readFileSync('d:\\AntiGravity\\ProjetoERP\\frontend\\src\\pages\\Proposals.jsx', 'utf8');

let stack = [];
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let j = 0; j < line.length; j++) {
        let char = line[j];
        if (char === '{') stack.push({ char, line: i + 1, col: j + 1 });
        else if (char === '}') {
            if (stack.length === 0 || stack[stack.length - 1].char !== '{') {
                console.log(`Unmatched } at ${i + 1}:${j + 1}`);
            } else {
                stack.pop();
            }
        }
        else if (char === '(') stack.push({ char, line: i + 1, col: j + 1 });
        else if (char === ')') {
            if (stack.length === 0 || stack[stack.length - 1].char !== '(') {
                console.log(`Unmatched ) at ${i + 1}:${j + 1}`);
            } else {
                stack.pop();
            }
        }
    }
}

if (stack.length > 0) {
    console.log('Unclosed items:');
    stack.forEach(item => console.log(`${item.char} at ${item.line}:${item.col}`));
} else {
    console.log('All balanced!');
}

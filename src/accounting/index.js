'use strict';

const readline = require('node:readline');

const INITIAL_BALANCE_CENTS = 100000;
const MAX_BALANCE_CENTS = 99999999;

function formatBalance(balanceCents) {
  return (balanceCents / 100).toFixed(2);
}

function parseAmount(amountInput) {
  const normalizedAmount = String(amountInput).trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedAmount)) {
    throw new Error('Invalid amount. Enter a non-negative amount with up to two decimal places.');
  }

  const [wholePart, decimalPart = ''] = normalizedAmount.split('.');
  const amountCents = Number(wholePart) * 100 + Number(decimalPart.padEnd(2, '0'));

  if (!Number.isSafeInteger(amountCents) || amountCents > MAX_BALANCE_CENTS) {
    throw new Error('Invalid amount. The maximum amount is 999999.99.');
  }

  return amountCents;
}

class DataProgram {
  constructor(initialBalanceCents = INITIAL_BALANCE_CENTS) {
    this.storageBalanceCents = initialBalanceCents;
  }

  call(operationType, balanceCents) {
    switch (String(operationType).trim()) {
      case 'READ':
        return this.storageBalanceCents;
      case 'WRITE':
        if (!Number.isSafeInteger(balanceCents) || balanceCents < 0 || balanceCents > MAX_BALANCE_CENTS) {
          throw new Error('Balance is outside the supported range.');
        }
        this.storageBalanceCents = balanceCents;
        return this.storageBalanceCents;
      default:
        return balanceCents;
    }
  }
}

class Operations {
  constructor(dataProgram = new DataProgram()) {
    this.dataProgram = dataProgram;
  }

  execute(operationType, amountInput) {
    switch (String(operationType).trim()) {
      case 'TOTAL': {
        const balanceCents = this.dataProgram.call('READ');
        return `Current balance: ${formatBalance(balanceCents)}`;
      }
      case 'CREDIT': {
        const amountCents = parseAmount(amountInput);
        const currentBalanceCents = this.dataProgram.call('READ');
        const newBalanceCents = currentBalanceCents + amountCents;
        this.dataProgram.call('WRITE', newBalanceCents);
        return `Amount credited. New balance: ${formatBalance(newBalanceCents)}`;
      }
      case 'DEBIT': {
        const amountCents = parseAmount(amountInput);
        const currentBalanceCents = this.dataProgram.call('READ');

        if (currentBalanceCents < amountCents) {
          return 'Insufficient funds for this debit.';
        }

        const newBalanceCents = currentBalanceCents - amountCents;
        this.dataProgram.call('WRITE', newBalanceCents);
        return `Amount debited. New balance: ${formatBalance(newBalanceCents)}`;
      }
      default:
        return '';
    }
  }
}

function displayMenu() {
  console.log('--------------------------------');
  console.log('Account Management System');
  console.log('1. View Balance');
  console.log('2. Credit Account');
  console.log('3. Debit Account');
  console.log('4. Exit');
  console.log('--------------------------------');
}

async function main(input = process.stdin, output = process.stdout) {
  const interfaceInstance = readline.createInterface({ input, output });
  const lineIterator = interfaceInstance[Symbol.asyncIterator]();
  const ask = async (prompt) => {
    output.write(prompt);
    const nextLine = await lineIterator.next();
    return nextLine.done ? null : nextLine.value;
  };
  const operations = new Operations();
  let continueRunning = true;

  try {
    while (continueRunning) {
      displayMenu();
      const choiceInput = await ask('Enter your choice (1-4): ');

      if (choiceInput === null) {
        break;
      }

      const choice = choiceInput.trim();

      switch (choice) {
        case '1':
          console.log(operations.execute('TOTAL'));
          break;
        case '2':
          const creditAmount = await ask('Enter credit amount: ');
          if (creditAmount === null) {
            continueRunning = false;
            break;
          }
          console.log(operations.execute('CREDIT', creditAmount));
          break;
        case '3':
          const debitAmount = await ask('Enter debit amount: ');
          if (debitAmount === null) {
            continueRunning = false;
            break;
          }
          console.log(operations.execute('DEBIT', debitAmount));
          break;
        case '4':
          continueRunning = false;
          break;
        default:
          console.log('Invalid choice, please select 1-4.');
      }
    }
  } finally {
    interfaceInstance.close();
  }

  console.log('Exiting the program. Goodbye!');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  DataProgram,
  Operations,
  formatBalance,
  main,
  parseAmount,
};
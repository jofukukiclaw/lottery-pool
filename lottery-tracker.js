#!/usr/bin/env node
/**
 * Lottery Pool Tracker - Balance Calculator
 * 
 * Calculates member balances and pool statistics from pool-data.json
 * Usage: node lottery-tracker.js [command]
 * 
 * Commands:
 *   balances     - Show member balances (default)
 *   stats        - Show pool statistics
 *   report       - Generate full report (JSON)
 *   check        - Check if jackpots meet threshold
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'pool-data.json');

function loadData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading pool-data.json:', err.message);
        process.exit(1);
    }
}

function calculateBalances(data) {
    const activeMembers = data.members.filter(m => m.active);
    
    // Initialize balances with contributions
    const balances = {};
    activeMembers.forEach(m => {
        balances[m.id] = {
            name: m.name,
            contributed: 0,
            shareOfCosts: 0,
            balance: 0
        };
    });
    
    // Add contributions
    data.contributions.forEach(c => {
        if (balances[c.memberId]) {
            balances[c.memberId].contributed += c.amount;
        }
    });
    
    // Calculate share of costs (only tickets funded by contributions, not winnings)
    // Now with participant tracking
    let totalContributionCosts = 0;
    data.tickets.forEach(t => {
        // Skip tickets funded by winnings or free play
        if (t.fundedBy === 'winnings' || t.freePlay) {
            return;
        }
        
        // If participants specified, only they share the cost
        if (t.participants && Array.isArray(t.participants) && t.participants.length > 0) {
            const numParticipants = t.participants.length;
            const costPerParticipant = t.cost / numParticipants;
            
            t.participants.forEach(memberId => {
                if (balances[memberId]) {
                    balances[memberId].shareOfCosts += costPerParticipant;
                }
            });
        } else {
            // Legacy: all members share cost
            totalContributionCosts += t.cost;
        }
    });
    
    // For legacy tickets without participants, distribute evenly
    if (totalContributionCosts > 0) {
        const perPersonShare = totalContributionCosts / activeMembers.length;
        activeMembers.forEach(m => {
            balances[m.id].shareOfCosts += perPersonShare;
        });
    }
    
    // Calculate final balances
    activeMembers.forEach(m => {
        balances[m.id].balance = balances[m.id].contributed - balances[m.id].shareOfCosts;
    });
    
    // Calculate total costs
    const totalCosts = Object.values(balances).reduce((sum, b) => sum + b.shareOfCosts, 0);
    
    return {
        balances,
        totalContributionCosts: totalCosts,
        perPersonShare: totalCosts / activeMembers.length
    };
}

function calculateWinnings(data) {
    if (!data.winnings) {
        return { totalWon: 0, totalClaimed: 0, availableForTickets: 0 };
    }
    
    return {
        totalWon: data.winnings.totalWon || 0,
        totalClaimed: data.winnings.totalClaimed || 0,
        availableForTickets: data.winnings.availableForTickets || 0,
        history: data.winnings.history || []
    };
}

function calculateTicketStats(data) {
    const stats = {
        total: data.tickets.length,
        totalCost: 0,
        fromContributions: 0,
        fromWinnings: 0,
        freePlays: 0,
        wins: 0,
        totalWon: 0
    };
    
    data.tickets.forEach(t => {
        stats.totalCost += t.cost;
        
        if (t.freePlay) {
            stats.freePlays++;
        } else if (t.fundedBy === 'winnings') {
            stats.fromWinnings += t.cost;
        } else {
            stats.fromContributions += t.cost;
        }
        
        if (t.won && t.prizeAmount) {
            stats.wins++;
            stats.totalWon += t.prizeAmount;
        }
    });
    
    return stats;
}

function formatCurrency(amount) {
    return '$' + amount.toFixed(2);
}

function showBalances(data) {
    const { balances, totalContributionCosts, perPersonShare } = calculateBalances(data);
    const winnings = calculateWinnings(data);
    
    console.log('=== Pool Member Balances ===\n');
    console.log(`Total spent from contributions: ${formatCurrency(totalContributionCosts)}`);
    console.log(`Cost per person: ${formatCurrency(perPersonShare)}\n`);
    
    console.log('Member           Contributed    Share      Balance');
    console.log('─────────────────────────────────────────────────────');
    
    Object.values(balances).forEach(b => {
        const status = b.balance >= 0 ? 'credit' : 'owes';
        const balanceStr = b.balance >= 0 
            ? `+${formatCurrency(b.balance)}` 
            : `-${formatCurrency(Math.abs(b.balance))}`;
        
        console.log(
            `${b.name.padEnd(15)} ${formatCurrency(b.contributed).padStart(10)} ${formatCurrency(b.shareOfCosts).padStart(10)} ${balanceStr.padStart(10)} ${status}`
        );
    });
    
    console.log('\n=== Winnings Pool ===');
    console.log(`Total won to date: ${formatCurrency(winnings.totalWon)}`);
    console.log(`Total claimed: ${formatCurrency(winnings.totalClaimed)}`);
    console.log(`Available for tickets: ${formatCurrency(winnings.availableForTickets)}`);
}

function showStats(data) {
    const stats = calculateTicketStats(data);
    const { totalContributionCosts } = calculateBalances(data);
    const winnings = calculateWinnings(data);
    
    console.log('=== Pool Statistics ===\n');
    console.log(`Total tickets: ${stats.total}`);
    console.log(`Winning tickets: ${stats.wins}`);
    console.log(`Win rate: ${stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : 0}%`);
    console.log(`\nTotal spent on tickets: ${formatCurrency(stats.totalCost)}`);
    console.log(`  From contributions: ${formatCurrency(stats.fromContributions)}`);
    console.log(`  From winnings: ${formatCurrency(stats.fromWinnings)}`);
    console.log(`  Free plays: ${stats.freePlays}`);
    console.log(`\nTotal won: ${formatCurrency(stats.totalWon)}`);
    console.log(`Net profit/loss: ${formatCurrency(stats.totalWon - stats.totalCost)}`);
    console.log(`ROI: ${stats.totalCost > 0 ? (((stats.totalWon - stats.totalCost) / stats.totalCost) * 100).toFixed(1) : 0}%`);
    
    console.log('\n=== Pool Balance ===');
    const totalContributed = data.contributions.reduce((sum, c) => sum + c.amount, 0);
    console.log(`Total contributions: ${formatCurrency(totalContributed)}`);
    console.log(`Spent from contributions: ${formatCurrency(stats.fromContributions)}`);
    console.log(`Pool balance (contributions): ${formatCurrency(totalContributed - stats.fromContributions)}`);
    console.log(`Winnings available: ${formatCurrency(winnings.availableForTickets)}`);
    console.log(`Total funds: ${formatCurrency(totalContributed - stats.fromContributions + winnings.availableForTickets)}`);
}

function generateReport(data) {
    const { balances, totalContributionCosts, perPersonShare } = calculateBalances(data);
    const winnings = calculateWinnings(data);
    const stats = calculateTicketStats(data);
    
    const report = {
        generatedAt: new Date().toISOString(),
        members: Object.values(balances).map(b => ({
            name: b.name,
            contributed: b.contributed,
            shareOfCosts: b.shareOfCosts,
            balance: b.balance,
            status: b.balance >= 0 ? 'credit' : 'owes'
        })),
        finances: {
            totalContributions: data.contributions.reduce((sum, c) => sum + c.amount, 0),
            spentFromContributions: stats.fromContributions,
            spentFromWinnings: stats.fromWinnings,
            poolBalance: data.contributions.reduce((sum, c) => sum + c.amount, 0) - stats.fromContributions,
            winningsAvailable: winnings.availableForTickets,
            totalFunds: data.contributions.reduce((sum, c) => sum + c.amount, 0) - stats.fromContributions + winnings.availableForTickets
        },
        winnings: {
            totalWon: winnings.totalWon,
            totalClaimed: winnings.totalClaimed,
            availableForTickets: winnings.availableForTickets
        },
        tickets: {
            total: stats.total,
            wins: stats.wins,
            totalSpent: stats.totalCost,
            totalWon: stats.totalWon,
            net: stats.totalWon - stats.totalCost,
            roi: stats.totalCost > 0 ? ((stats.totalWon - stats.totalCost) / stats.totalCost) * 100 : 0
        }
    };
    
    return report;
}

function checkJackpots(data) {
    // This would need to fetch actual jackpot data
    // For now, just show the threshold and current draws
    console.log('=== Jackpot Check ===\n');
    console.log(`Threshold: ${formatCurrency(data.settings.jackpotThreshold)}`);
    console.log(`Games tracked: ${data.settings.games.join(', ')}`);
    console.log(`\nUpcoming draws:`);
    
    data.draws.forEach(d => {
        const jackpotStr = d.jackpot >= 1000000 
            ? `$${(d.jackpot / 1000000).toFixed(0)} Million`
            : formatCurrency(d.jackpot);
        const status = d.jackpot >= data.settings.jackpotThreshold ? '🔥 ABOVE THRESHOLD' : 'below threshold';
        console.log(`  ${d.game}: ${jackpotStr} (${status})`);
    });
}

function showTickets(data) {
    console.log('=== Tickets with Participants ===\n');
    
    data.tickets.forEach((t, i) => {
        const funded = t.freePlay ? 'FREE PLAY' : t.fundedBy === 'winnings' ? 'Winnings' : 'Contributions';
        const participants = t.participants && t.participants.length > 0 
            ? t.participants.map(id => {
                const m = data.members.find(m => m.id === id);
                return m ? m.name : id;
            }).join(', ')
            : 'All members';
        
        console.log(`${i+1}. ${t.drawDate} - ${t.game.toUpperCase()}`);
        console.log(`   Cost: $${t.cost} (${funded})`);
        console.log(`   Participants: ${participants}`);
        if (t.won) {
            console.log(`   Result: 🎉 ${t.prizeType || 'Win'} - $${t.prizeAmount || 0}`);
        } else if (t.checked) {
            console.log(`   Result: ❌ No win`);
        } else {
            console.log(`   Result: ⏳ Pending`);
        }
        console.log('');
    });
}

// Main
const command = process.argv[2] || 'balances';
const data = loadData();

switch (command) {
    case 'balances':
        showBalances(data);
        break;
    case 'stats':
        showStats(data);
        break;
    case 'report':
        console.log(JSON.stringify(generateReport(data), null, 2));
        break;
    case 'check':
        checkJackpots(data);
        break;
    case 'tickets':
        showTickets(data);
        break;
    default:
        console.log('Usage: node lottery-tracker.js [command]');
        console.log('');
        console.log('Commands:');
        console.log('  balances  - Show member balances (default)');
        console.log('  stats     - Show pool statistics');
        console.log('  report    - Generate full report (JSON)');
        console.log('  check     - Check jackpot thresholds');
        console.log('  tickets   - Show tickets with participants');
        process.exit(1);
}

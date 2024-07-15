// Charger jQuery
var jqueryScript = document.createElement('script');
jqueryScript.setAttribute('src', 'https://code.jquery.com/jquery-3.6.0.min.js');
jqueryScript.onload = function() {
    $('table#table_summary, table#table_assets').remove();

    let spotUSDT = 670.00;
    let tableData = [];
    let summary = {}; // qty, pnl
    let assets = {};  // asset, qty, nbr, nbrTP, pnl
    let trades = [];
    let bots = {
        'BTC-USDT': [28, 0],
        'ETH-USDT': [29, 0],
        'XRP-USDT': [30, 0],
        'SOL-USDT': [61, 0],
        'BGB-USDT': [62, 0],
        'ETH-BTC': [64, 0],
        'PAXG-USDT': [73, 0],
        'BGB-ETH': [77, 0],
        
        'BLAST-USDT': [58, 0],
        'AR-USDT': [69, 0]
    };
    
    // Créer une fonction pour effectuer une requête AJAX et récupérer la valeur
    function fetchFollowerAllocation(botName, botId) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: "https://www.tradersioux.fr/copybots/" + botId,
                type: "GET",
                success: function(data) {
                    let followerAllocation = $(data).find('input#follower-allocation-input[name="follower-available"]').val();
                    resolve([botName, botId, followerAllocation]);
                },
                error: function(xhr, status, error) {
                    reject(error);
                }
            });
        });
    }

    // Liste des Promises pour chaque requête AJAX
    let promises = Object.entries(bots).map(([botName, [botId, followerAllocation]]) => {
        return fetchFollowerAllocation(botName, botId);
    });
    
    // Utiliser Promise.all pour attendre que toutes les requêtes soient terminées
    Promise.all(promises)
        .then(results => {
            results.forEach(([botName, botId, followerAllocation]) => {
                bots[botName][1] = followerAllocation;
            });
            console.log(bots);
            getDatas();
            processDatas();
            showStats();
        })
        .catch(error => {
            console.error("Erreur lors de la récupération des données:", error);
        });


    function getDatas(){
        let id = 0;
        document.querySelectorAll('.table-striped tbody tr').forEach(function(row) {
            
            let useElement = row.querySelector('use');
            if (useElement) {
                if(useElement.getAttribute("xlink:href") === "#check-circle") {
                    let cells = row.querySelectorAll('td');
                    let asset = `${cells[5].innerText.split(" ")[1]}-${cells[6].innerText.split(" ")[1]}`;
                    cells[1].innerText = asset;
            
                    let rowData = [id, ...Array.from(cells, cell => cell.innerText)];
                    tableData.push(rowData);
                }
            }
            id++;
        });
    }



    function processDatas(){
        let tableDataReversed = tableData.reverse();
        let trade = ['', 0, 0, 0, 0]; // [actualBotIdAndPos, qty, priceBuy, priceSell, pnl];
        let botIdAndPos = '';
    
        tableDataReversed.forEach(function(t) {
            if(bots[t[2]] && bots[t[2]][1] !== undefined){
                let actualBotIdAndPos = `${t[2]} #${t[3]}`;
                let qty = parseFloat(t[6].split(" ")[0]);
                let pos = parseFloat(t[8].split(" ")[0]);
        
                if (!assets[t[2]]) {
                    assets[t[2]] = [0, 0, 0, 0, 0];
                }
                let asset = assets[t[2]];
        
                if (actualBotIdAndPos !== botIdAndPos) {
                    if (botIdAndPos !== '') 
                        trades.push(trade);
                    trade = [actualBotIdAndPos, 0, 0, 0, 0];
                    botIdAndPos = actualBotIdAndPos;
                }
        
                if (t[5] === 'buy') {
                    trade = [actualBotIdAndPos, trade[1] + qty, trade[2] + pos, trade[3], trade[4]];
                    asset[0] += pos;
                    asset[1] += qty;
                    asset[3] -= pos;
                    asset[4]++;
                } else {
                    let pnl = pos - trade[2];
                    trade = [trade[0], qty, trade[2], pos, pnl];
                    asset[0] = 0;
                    asset[1] = 0;
                    asset[2] += 1;
                    asset[3] += pos;
                    asset[4] = 0;
                }
                
                //debug([pos, trade, asset[3]], t[2], 'BLAST-USDT');
        
                assets[t[2]] = asset;
            }
        });
        
        trades.push(trade);
    
        console.log(assets);
        console.log(trades);
    }

    
    


    function showStats(){
    
        // Générer le HTML pour les actifs
        let assetsHTML = '<table id="table_assets" class="table table-striped" style="font-size:14px; margin-top:30px;"><thead><tr><th>Asset</th><th>Profit</th><th>Nbr TP</th><th>Position n°</th><th>Liquidité active / assignée</th><th>Qty Actif</th><th>Prix moyen</th><th>TP Cible</th></tr></thead><tbody>';
        Object.entries(assets).forEach(([k, v]) => {
            if(bots[k] && bots[k][1] !== undefined){
                let [_a, _b] = k.split('-');
                let avg_price = v[0] / v[1];
                
                if (!summary[_b]) {
                    summary[_b] = [0, 0];
                }
                let pnl = v[3]+v[0];
                summary[_b] = [summary[_b][0] + v[0], summary[_b][1] + pnl];
                
                
                assetsHTML += `<tr>
                    <td class="text-center">${k}</td>
                    <td class="text-center">${roundNumber(pnl, 2, _b)} ${_b}</td>
                    <td class="text-center">${v[2]}</td>
                    <td class="text-center">${v[4]}/7</td>
                    <td class="text-center">${roundNumber(v[0], 2, _b)} / ${roundNumber(parseFloat(bots[k][1])+v[0], 2, _b)} ${_b}</td>
                    <td class="text-center">${roundNumber(v[1], 6)} ${_a}</td>
                    <td class="text-center">${roundNumber(avg_price, 6, _b)} ${_b}</td>
                    <td class="text-center">~${roundNumber(avg_price*1.02, 6, _b)} ${_b}</td>
                </tr>`;
            }
        });
        assetsHTML += '</tbody></table>';

        
        // Générer le HTML pour le résumé
        let summaryHTML = '<table id="table_summary" class="table table-striped" style="font-size:14px; margin-top:30px;"><thead><tr><th>Asset</th><th>Profits</th><th>Qty Actif</th></tr></thead><tbody>';
        Object.entries(summary).forEach(([k, v]) => {
            let additionnalUSDT = '';
            if(k === 'USDT') {
                additionnalUSDT = `/ ${spotUSDT} ${k} | left: ${roundNumber(spotUSDT-v[0], 2, k)}`;
            }
            summaryHTML += `<tr><td>${k}</td><td>${roundNumber(v[1], 2, k)} ${k}</td><td>${roundNumber(v[0], 2, k)} ${additionnalUSDT} ${k}</td></tr>`;
        });
        summaryHTML += '</tbody></table>';
        $('.container h1').append(summaryHTML);
        $('.container h1').append(assetsHTML);
    }

    
};
document.head.appendChild(jqueryScript);

function roundNumber(n = 0, d = 2, a = 'USDT') {
    return a === 'USDT' ? n.toFixed(d) : n.toFixed(8);
}

function debug(text, needle = null, asset = null){
    if(needle === asset){
        console.log(text);
    }
}

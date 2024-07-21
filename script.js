// Charger jQuery
var jqueryScript = document.createElement('script');
jqueryScript.setAttribute('src', 'https://code.jquery.com/jquery-3.6.0.min.js');
jqueryScript.onload = function() {
    $('table#table_summary, table#table_assets').remove();

    let spotAssetTransferred = {
        'USDT': 670,
        'ETH': 0.3,
        'BTC': 0.07,
    };
    
    let tableData = [];
    let chartData = {};
    let drawdown = {};
    let summary = {}; // qty, pnl
    let assets = {};  // asset, qty, nbr, nbrTP, pnl
    let assetActive = {};
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
                bots[botName][1] = parseFloat(followerAllocation);
            });
            console.log(bots);
            getDatas();
            processDatas();
            showStats();
            showChart();
        })
        .catch(error => {
            console.error("Erreur lors de la récupération des données:", error);
        });


    function getDatas(){
        let id = 0;
        document.querySelectorAll('.table-striped tbody tr').forEach(function(row) {
            
            let useElement = row.querySelector('use');
            if (useElement) {
                let cells = row.querySelectorAll('td');
                if(useElement.getAttribute("xlink:href") === "#check-circle" || cells[4].innerText == "sell") {
                    if(cells[4].innerText == "sell") {
                        $(cells[4]).css("color", "red");
                    } else {
                        $(cells[4]).css("color", "green");
                    }
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
        let cumulativePos = {};
        let cumulativeDrawdown = {};
        chartData['USDT'] = [];
        cumulativePos['USDT'] = 0;
    
        tableDataReversed.forEach(function(t) {
            let actualBotIdAndPos = `${t[2]} #${t[3]}`;
            let dateOfTrade = convertToDateObject(t[1]);
            let currency = t[8].split(" ")[1];
            let qty = parseFloat(t[6].split(" ")[0]);
            let pos = parseFloat(t[8].split(" ")[0]);
            /*if(t[8].split(" ")[1] === 'USDT' && t[2] == 'AR-USDT'){
                cumulativePos += (t[5]==='buy')?(0-pos):pos;
                chartData.push({x:convertToDateObject(t[1]), y:cumulativePos});
            }*/
            
            if(bots[t[2]] && bots[t[2]][1] !== undefined && t[4] === 'bitget (spot)'){
                if (!assets[t[2]]) {
                    assets[t[2]] = [0, 0, 0, 0, 0];
                }
                if (!assetActive[t[2]]) {
                    assetActive[t[2]] = 0;
                }
                let asset = assets[t[2]];
        
                if (actualBotIdAndPos !== botIdAndPos) {
                    if (botIdAndPos !== '') 
                        trades.push(trade);
                    trade = [actualBotIdAndPos, 0, 0, 0, 0];
                    botIdAndPos = actualBotIdAndPos;
                }

                let pnl = 0;
                if (t[5] === 'buy') {
                    trade = [actualBotIdAndPos, trade[1] + qty, trade[2] + pos, trade[3], trade[4]];
                    asset[0] += pos;
                    asset[1] += qty;
                    asset[3] -= pos;
                    asset[4]++;
                    assetActive[t[2]] += pos;
                } else {
                    pnl = pos - assetActive[t[2]];
                    trade = [trade[0], qty, trade[2], pos, pnl];
                    asset[0] = 0;
                    asset[1] = 0;
                    asset[2] += 1;
                    asset[3] += pos;
                    asset[4] = 0;
                    assetActive[t[2]] = 0;
                }
                
                if (!chartData[t[2]]) {
                    chartData[t[2]] = [];
                    cumulativePos[t[2]] = 0;
                }
                cumulativePos[t[2]] += pnl;
                chartData[t[2]].push({x:dateOfTrade, y:cumulativePos[t[2]]});
                
                if(currency === 'USDT'){
                    cumulativePos['USDT'] += pnl;
                    chartData['USDT'].push({x:dateOfTrade, y:cumulativePos['USDT']});
                }
                
                if(bots[t[2]] && bots[t[2]][1] !== undefined && bots[t[2]][1] > 0){
                    
                    if (!drawdown[currency]) {
                        drawdown[currency] = [];
                        cumulativeDrawdown[currency] = 0;
                    }
                    
                    drawdown[currency].push({x: (new Date(dateOfTrade.getTime() - 1)), y:cumulativeDrawdown[currency]});
                    
                    cumulativeDrawdown[currency] += ((t[5] === 'buy')?(pos*(-1)):pos)
                    drawdown[currency].push({x:dateOfTrade, y:cumulativeDrawdown[currency]});
                }
        
                assets[t[2]] = asset;
            }
        });
        
        trades.push(trade);
    
        //console.log(assets);
        console.log(trades);
    }

    
    


    function showStats(){
    
        // Générer le HTML pour les actifs
        let assetsHTML = '<table id="table_assets" class="table table-striped" style="font-size:13px; margin-top:30px;"><thead><tr><th>Asset</th><th>Profit</th><th>Nbr TP</th><th>Position n°</th><th>Liquidité active / assignée</th><th>Qty Actif</th><th>Prix moyen</th><th>TP Cible</th></tr></thead><tbody>';
        Object.entries(assets).forEach(([k, v]) => {
            if(bots[k] && bots[k][1] !== undefined && bots[k][1] > 0){
                let [_a, _b] = k.split('-');
                let avg_price = v[0] / v[1];
                
                if (!summary[_b]) {
                    summary[_b] = [0, 0, 0];
                }
                let pnl = v[3]+v[0];
                summary[_b] = [summary[_b][0] + v[0], summary[_b][1] + pnl, summary[_b][2] + bots[k][1] + v[0]];
                
                
                assetsHTML += `<tr>
                    <td class="text-center">${k}</td>
                    <td class="text-center">${((pnl == 0)?'':roundNumber(pnl, 2, _b) + ' ' + _b + ' (' +  roundNumber(100*pnl/(bots[k][1]+v[0]), 2) + '%)')}</td>
                    <td class="text-center">${(v[2]==0)?'':v[2]}</td>
                    <td class="text-center">${((v[4]==0)?'':v[4]+'/8')}</td>
                    <td class="text-center">${roundNumber(v[0], 2, _b)} / ${roundNumber(bots[k][1]+v[0], 2, _b)} ${_b}</td>
                    <td class="text-center">${((v[1] == 0)?'':roundNumber(v[1], 6) + ' ' + _a)}</td>
                    <td class="text-center">${((v[1] == 0)?'':roundNumber(avg_price, 6, _b) + ' ' + _b)}</td>
                    <td class="text-center">${((v[1] == 0)?'':'~'+roundNumber(avg_price*1.02, 6, _b) + ' ' + _b)}</td>
                </tr>`;
            }
        });
        assetsHTML += '</tbody></table>';

        
        // Générer le HTML pour le résumé
        let summaryHTML = '<table id="table_summary" class="table table-striped" style="font-size:14px; margin-top:30px;"><thead><tr><th>Asset</th><th>Profits</th><th>Liquidité active / assignée</th><th>Liquidité restante / total</th></tr></thead><tbody>';
        Object.entries(summary).forEach(([k, v]) => {
            let additionnalAsset = '';
            if(spotAssetTransferred[k] && spotAssetTransferred[k] !== undefined && spotAssetTransferred[k] > 0) {
                additionnalAsset = `${roundNumber(spotAssetTransferred[k]-v[0]+v[1], 2, k)} / ${spotAssetTransferred[k]}  ${k}`;
            }
            summaryHTML += `<tr><td>${k}</td>
                <td>${roundNumber(v[1], 2, k)} ${k} (${roundNumber(100*v[1]/v[2], 2)}%)</td>
                <td>${roundNumber(v[0], 2, k)} / ${roundNumber(v[2], 2, k)}  ${k}</td>
                <td>${additionnalAsset}</td>
            </tr>`;
        });
        summaryHTML += '</tbody></table>';
        $('.container h1').append(summaryHTML);
        $('.container h1').append(assetsHTML);
    }


    

    function showChart() {
        let canvaStyle = 'style="width:100%; max-height:340px;"';
        $('p#botsChartText').remove();
        $('canvas#botsChart').remove();
        $('canvas#drawdownChart').remove();
        $('canvas#profitChart').remove();
        $('.container h1').append('<canvas id="drawdownChart" '+canvaStyle+'></canvas><p id="botsChartText" style="font-size: 12px; margin:0;">Cliquez sur la légende pour filtrer les paires :</p><canvas id="profitChart" '+canvaStyle+'></canvas>');
        console.log(chartData);
    
        
        var chartScript = document.createElement('script');
        chartScript.setAttribute('src', 'https://cdn.jsdelivr.net/npm/chart.js');
        chartScript.onload = function() {
            var chartTimeScript = document.createElement('script');
            chartTimeScript.setAttribute('src', 'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns');
            chartTimeScript.onload = function() {

                let colorGraphLine = {'USDT': 'rgba(83, 225, 214, 1)', 'ETH': 'rgba(190, 200, 190, 1)', 'BTC': 'rgba(200, 100, 143, 1)'}
                let datasets = [];
                Object.entries(drawdown).forEach(([k, v]) => {
                    datasets.push({label: 'DrawDown ' + k, data: v, fill: false, borderColor: colorGraphLine[k], yAxisID: (k === 'USDT')?'y-axis-1':'y-axis-2',});
                });
                
                let chart = new Chart('drawdownChart', {
                    type: 'line',
                    data: {datasets: datasets},
                    options: {
                        scales: {
                            x: {
                                type: 'time',
                                time: {
                                    unit: 'day',
                                    tooltipFormat: 'dd/MM/yyyy HH:mm:ss',
                                    displayFormats: {day: 'dd/MM'}
                                },
                                title: {display: true, text: 'Date'}
                            },
                            'y-axis-1': {
                                type: 'linear',
                                position: 'left',
                                title: {display: true, text: 'USDT'}
                            },
                            'y-axis-2': {
                                type: 'linear',
                                position: 'right',
                                title: {display: true, text: 'BTC | ETH'}
                            }
                        }
                    }
                });



                var chartFinanceScript = document.createElement('script');
                chartFinanceScript.setAttribute('src', 'https://cdn.jsdelivr.net/npm/chartjs-chart-financial');
                chartFinanceScript.onload = function() {

                    
                    let financialData = convertToDailyFinancialData(chartData['USDT']);
                    console.log(financialData[financialData.lenght - 1])

                    
                    let datasets = [];
                    datasets.push({
                        label: 'USDT - Profits',
                        data: financialData
                    });
                    
                    Object.entries(chartData).forEach(([k, v]) => {
                        datasets.push({
                            type: 'line',
                            label: k, 
                            data: v, 
                            fill: false, 
                            borderColor: getRandomColor(), 
                            hidden: true,
                        });
                    });
        
                    let chart = new Chart('profitChart', {
                        type: 'candlestick',
                        data: {
                            datasets: datasets
                        },
                        options: {
                            scales: {
                                x: {
                                    type: 'time',
                                    min: financialData[0].x,
                                    max: financialData[financialData.length-1].x,
                                    time: {
                                        unit: 'day',
                                        tooltipFormat: 'dd/MM/yyyy',
                                        displayFormats: {day: 'dd/MM'}
                                    },
                                    title: {display: true, text: 'Date'}
                                },
                                y: {
                                    beginAtZero: true,
                                    title: {display: true, text: 'Value'}
                                }
                            }
                        }
                    });
                
                };
                document.head.appendChild(chartFinanceScript);
            };
            document.head.appendChild(chartTimeScript);
        };
        document.head.appendChild(chartScript);
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


function convertToDateObject(dateStr) {
    const [date, time] = dateStr.split(' ');
    const [day, month, year] = date.split('/');
    return new Date(`${year}-${month}-${day}T${time}`);
}


function getRandomColor() {
    const r = Math.floor(Math.random() * 255);
    const g = Math.floor(Math.random() * 255);
    const b = Math.floor(Math.random() * 255);
    return `rgba(${r}, ${g}, ${b}, 1)`;
}

function convertToDailyFinancialData(data) {
    let groupedData = {};
    
    // Grouper les données par jour
    data.forEach(point => {
        let date = new Date(point.x);
        let dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        
        if (!groupedData[dayKey]) {
            groupedData[dayKey] = [];
        }
        groupedData[dayKey].push(point.y);
    });
    
    // Créer un tableau de dates complètes
    let startDate = new Date(Math.min(...data.map(point => new Date(point.x))));
    let endDate = new Date(Math.max(...data.map(point => new Date(point.x))));
    let currentDate = new Date(startDate);
    let allDates = [];

    endDate.setDate(endDate.getDate() + 1);
    while (currentDate <= endDate) {
        allDates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    let financialData = [];
    let lastClose = 0;
    for (let i = 0; i < allDates.length; i++) {
        let dayKey = `${allDates[i].getFullYear()}-${allDates[i].getMonth() + 1}-${allDates[i].getDate()}`;
        let yValues = groupedData[dayKey] || [];
        
        financialData.push({
            x: allDates[i].getTime(),
            o: lastClose,
            h: yValues.length ? roundNumber(Math.max(...yValues)) : lastClose,
            l: lastClose,
            c: yValues.length ? roundNumber(yValues[yValues.length - 1]) : lastClose
        });

        lastClose = yValues.length ? roundNumber(yValues[yValues.length - 1]) : lastClose;
    }

    console.log(financialData);

    return financialData;
}

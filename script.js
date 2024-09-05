let data = [];
let tokens = [];
let initialNodes = [];
let initialEdges = [];
let initialLayout = {};

document.addEventListener("DOMContentLoaded", () => {
    updateYearRangeDisplay();
    loadDataForYearRange();
});

document.getElementById('yearRangeStart').addEventListener('input', updateYearRangeDisplay);
document.getElementById('yearRangeEnd').addEventListener('input', updateYearRangeDisplay);

function updateYearRangeDisplay() {
    const startYear = document.getElementById('yearRangeStart').value;
    const endYear = document.getElementById('yearRangeEnd').value;
    document.getElementById('yearRangeDisplay').textContent = `${startYear} - ${endYear}`;
}

async function loadDataForYearRange() {
    const startYear = parseInt(document.getElementById('yearRangeStart').value);
    const endYear = parseInt(document.getElementById('yearRangeEnd').value);
    data = []; // Clear previous data
    let totalWords = 0;
    document.getElementById('wordLimitMessage').textContent = ''; // Clear previous message

    for (let year = startYear; year <= endYear; year++) {
        if (totalWords >= 9999999) {
            document.getElementById('wordLimitMessage').textContent = `Reached the word limit at year ${year - 1}.`;
            console.log("Reached the word limit. Stopping data loading.");
            break;
        }

        try {
            const response = await fetch(`date/${year}.xml`);
            if (response.ok) {
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");

                const textElements = xmlDoc.getElementsByTagName('TEXT');
                const textContent = Array.from(textElements).map(elem => elem.textContent).join(' ');

                const words = textContent.split(/\W+/).filter(Boolean);
                totalWords += words.length;

                if (totalWords > 9999999) {
                    document.getElementById('wordLimitMessage').textContent = `Reached the word limit at year ${year}.`;
                    console.log("Reached the word limit during processing. Stopping data loading.");
                    break;
                }

                data.push({ year: year, fullText: textContent });
            }
        } catch (error) {
            console.error(`Error loading data for year ${year}:`, error);
        }
    }

    console.log("Total Words Processed:", totalWords);
    console.log("Full Text:", data.map(item => item.fullText).join(' '));
    console.log("Tokens:", getTokensForAllData());

    generateCrisisRatio();
    generateGraph();
    generateProbabilityGraph();
}

function getTokensForAllData() {
    const fullText = data.map(item => item.fullText).join(' ');
    return fullText.toLowerCase().split(/\W+/).filter(Boolean);
}

function generateCrisisRatio() {
    const targetWord = document.getElementById('targetWord').value.toLowerCase();
    const crisisRatioByYear = {};

    data.forEach(item => {
        const year = item.year;
        const text = item.fullText.toLowerCase();
        const wordCount = text.split(/\W+/).filter(Boolean).length;
        const targetCount = (text.match(new RegExp(targetWord, 'g')) || []).length;

        crisisRatioByYear[year] = targetCount / wordCount;
    });

    const years = Object.keys(crisisRatioByYear).sort((a, b) => a - b);
    const ratios = years.map(year => crisisRatioByYear[year]);

    const trace = {
        x: years,
        y: ratios,
        type: 'bar',
        marker: { color: 'lightcoral' }
    };

    const layout = {
        title: `Ratio of "${targetWord}" Per Year`,
        xaxis: { title: 'Year' },
        yaxis: { 
            title: `Ratio of "${targetWord}"`,
            tickformat: '.6f'
        }
    };

    Plotly.newPlot('crisisRatioGraph', [trace], layout);
}

function getCommonWords() {
    const textAreaValue = document.getElementById('commonWordsText').value;
    return new Set(textAreaValue.split(',').map(word => word.trim()));
}

document.getElementById('contextWindowSize').addEventListener('input', function() {
    document.getElementById('contextWindowSizeValue').textContent = this.value;
});

document.getElementById('neighborWeight').addEventListener('input', function() {
    document.getElementById('neighborWeightValue').textContent = this.value;
});

document.getElementById('targetProximityStrength').addEventListener('input', function() {
    document.getElementById('targetProximityStrengthValue').textContent = this.value;
});

function populateNeighborSelect(topWords) {
    const neighborSelect = document.getElementById('neighborSelect');
    neighborSelect.innerHTML = '';
    topWords.forEach(([word]) => {
        const option = document.createElement('option');
        option.value = word;
        option.textContent = word;
        neighborSelect.appendChild(option);
    });
}

function getSelectedNeighbor() {
    const neighborSelect = document.getElementById('neighborSelect').value;
    const neighborInput = document.getElementById('neighborInput').value.trim();
    
    return neighborInput || neighborSelect;
}

function calculatePMI(word1, word2, tokens, contextWindowSize) {
    const totalTokens = tokens.length;
    const freqWord1 = tokens.filter(word => word === word1).length;
    const freqWord2 = tokens.filter(word => word === word2).length;

    let coOccurrence = 0;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === word1) {
            const start = Math.max(i - contextWindowSize, 0);
            const end = Math.min(i + contextWindowSize + 1, tokens.length);
            if (tokens.slice(start, end).includes(word2)) {
                coOccurrence++;
            }
        }
    }

    const P_x = freqWord1 / totalTokens;
    const P_y = freqWord2 / totalTokens;
    const P_xy = coOccurrence / totalTokens;

    if (P_x === 0 || P_y === 0 || P_xy === 0 || isNaN(P_xy)) {
        return Number.NEGATIVE_INFINITY;
    }

    const pmi = Math.log2(P_xy / (P_x * P_y));
    return pmi;
}

function displayPMI() {
    const targetWord = document.getElementById('targetWord').value.toLowerCase();
    const selectedNeighbor = getSelectedNeighbor().toLowerCase();
    const contextWindowSize = parseInt(document.getElementById('contextWindowSize').value, 10);
    const tokens = getTokensForAllData();

    const pmi = calculatePMI(targetWord, selectedNeighbor, tokens, contextWindowSize);

    const pmiResult = document.getElementById('pmiResult');
    if (pmi === Number.NEGATIVE_INFINITY) {
        pmiResult.textContent = `PMI between "${targetWord}" and "${selectedNeighbor}" could not be calculated (probabilities are zero or no co-occurrence found).`;
    } else {
        pmiResult.textContent = `PMI between "${targetWord}" and "${selectedNeighbor}": ${pmi.toFixed(4)}`;
    }
}

function generateGraph() {
    const targetWord = document.getElementById('targetWord').value;
    const contextWindowSize = parseInt(document.getElementById('contextWindowSize').value);
    const topWordsCount = parseInt(document.getElementById('topWordsCount').value);
    const neighborsCount = parseInt(document.getElementById('neighborsCount').value);
    const commonWords = getCommonWords();

    const neighborWeight = parseFloat(document.getElementById('neighborWeight').value);
    const targetProximityStrength = parseFloat(document.getElementById('targetProximityStrength').value);

    const fullText = data.map(item => item.fullText).join(' ');
    tokens = fullText.toLowerCase().split(/\W+/);

    tokens = tokens.filter(word => !commonWords.has(word));

    const relatedWords = [];
    const neighborsDict = {};

    tokens.forEach((word, i) => {
        if (word === targetWord) {
            const start = Math.max(i - contextWindowSize, 0);
            const end = Math.min(i + contextWindowSize + 1, tokens.length);
            const context = tokens.slice(start, i).concat(tokens.slice(i + 1, end));
            relatedWords.push(...context);

            context.forEach(relatedWord => {
                if (!neighborsDict[relatedWord]) {
                    neighborsDict[relatedWord] = [];
                }
                neighborsDict[relatedWord].push(...context.filter(w => w !== relatedWord));
            });
        }
    });

    const wordFreq = {};
    relatedWords.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    const topWords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topWordsCount);

    populateNeighborSelect(topWords);

    const G = new Map();
    G.set(targetWord, wordFreq[targetWord] || 1);

    const edges = [];

    topWords.forEach(([word, freq]) => {
        G.set(word, freq);
        edges.push([targetWord, word]);
    
        if (neighborsDict[word]) {
            const neighbors = Object.entries(neighborsDict[word].reduce((acc, w) => {
                acc[w] = (acc[w] || 0) + 1;
                return acc;
            }, {}))
            .sort((a, b) => b[1] - a[1])
            .slice(0, neighborsCount);
    
            neighbors.forEach(([neighbor, neighborFreq]) => {
                if (!G.has(neighbor)) {
                    G.set(neighbor, neighborFreq);
                }
                if (neighborsDict[neighbor].includes(word)) {
                    edges.push([word, neighbor]);
                }
            });
        }
    });

    const maxFreq = Math.max(...Array.from(G.values()));

    const nodes = [];
    const nodeMap = new Map();

    G.forEach((size, word) => {
        const directFrequency = wordFreq[word] || 0;
        const targetProximity = Math.pow(1 - (size / maxFreq), targetProximityStrength / 4);
        const connectedEdges = edges.filter(edge => edge.includes(word)).length;
        let neighborProximity = Math.pow(connectedEdges, -neighborWeight);
        const combinedProximity = (targetProximity * (1 - neighborWeight)) + (neighborProximity * neighborWeight);
    
        const scale = 10;
        const node = {
            x: (Math.random() - 0.5) * combinedProximity * scale,
            y: (Math.random() - 0.5) * combinedProximity * scale,
            z: (Math.random() - 0.5) * combinedProximity * scale,
            text: word === targetWord ? word : `${word}: ${directFrequency}`,
            size: 10,
            word: word,
            color: size
        };
        nodes.push(node);
        nodeMap.set(word, node);
    });

    const targetNode = nodeMap.get(targetWord);
    if (targetNode) {
        targetNode.x = 0.5;
        targetNode.y = 0.5;
        targetNode.z = 0.5;
    }

    initialNodes = nodes.map(node => ({ ...node }));
    initialEdges = [...edges];

    const xValues = nodes.map(node => node.x);
    const yValues = nodes.map(node => node.y);
    const zValues = nodes.map(node => node.z);

    const xRange = [Math.min(...xValues) - 1, Math.max(...xValues) + 1];
    const yRange = [Math.min(...yValues) - 1, Math.max(...yValues) + 1];
    const zRange = [Math.min(...zValues) - 1, Math.max(...zValues) + 1];

    const minRange = [-5, 5];
    const adjustedXRange = [
        Math.min(minRange[0], xRange[0]),
        Math.max(minRange[1], xRange[1])
    ];
    const adjustedYRange = [
        Math.min(minRange[0], yRange[0]),
        Math.max(minRange[1], yRange[1])
    ];
    const adjustedZRange = [
        Math.min(minRange[0], zRange[0]),
        Math.max(minRange[1], zRange[1])
    ];

    initialLayout = {
        title: `  `,
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
            xaxis: { range: adjustedXRange, showbackground: false },
            yaxis: { range: adjustedYRange, showbackground: false },
            zaxis: { range: adjustedZRange, showbackground: false }
        },
        showlegend: false
    };

    const nodeTrace = {
        x: nodes.map(node => node.x),
        y: nodes.map(node => node.y),
        z: nodes.map(node => node.z),
        text: nodes.map(node => node.text),
        mode: 'markers+text',
        marker: {
            size: 10,
            color: nodes.map(node => node.color),
            colorscale: 'YlGnBu',
            colorbar: {
                title: {
                    text: 'Frequency to target word',
                },
                len: 0.8
            }
        },
        type: 'scatter3d',
        clickmode: 'event+select'
    };

    const edgeTrace = {
        x: [],
        y: [],
        z: [],
        mode: 'lines',
        line: {
            width: 0.5,
            color: '#888'
        },
        type: 'scatter3d'
    };

    edges.forEach(([from, to]) => {
        const fromNode = nodeMap.get(from);
        const toNode = nodeMap.get(to);
        if (fromNode && toNode) {
            edgeTrace.x.push(fromNode.x, toNode.x, null);
            edgeTrace.y.push(fromNode.y, toNode.y, null);
            edgeTrace.z.push(fromNode.z, toNode.z, null);
        }
    });

    Plotly.newPlot('graph', [edgeTrace, nodeTrace], initialLayout);

    document.getElementById('graph').on('plotly_click', function(data) {
        if (data.points[0].curveNumber === 1) {
            const clickedNode = data.points[0].text.split(':')[0];
            const visited = new Set();
            const toExplore = [clickedNode];
            const newNodes = new Set();
            const newEdges = [];

            while (toExplore.length > 0) {
                const currentNode = toExplore.pop();
                if (!visited.has(currentNode)) {
                    visited.add(currentNode);
                    newNodes.add(currentNode);

                    initialEdges.forEach(([from, to]) => {
                        if (from === currentNode || to === currentNode) {
                            newEdges.push([from, to]);
                            if ((from === currentNode && !visited.has(to) && to !== targetWord) || 
                                (to === currentNode && !visited.has(from) && from !== targetWord)) {
                                toExplore.push(from === currentNode ? to : from);
                            }
                        }
                    });
                }
            }

            newNodes.add(targetWord);

            const finalNodes = initialNodes.filter(node => newNodes.has(node.word));
            const finalEdges = newEdges.filter(([from, to]) => newNodes.has(from) && newNodes.has(to));

            const newEdgeTrace = {
                x: [],
                y: [],
                z: [],
                mode: 'lines',
                line: {
                    width: 0.5,
                    color: '#888'
                },
                type: 'scatter3d'
            };

            finalEdges.forEach(([from, to]) => {
                const fromNode = nodeMap.get(from);
                const toNode = nodeMap.get(to);
                if (fromNode && toNode) {
                    newEdgeTrace.x.push(fromNode.x, toNode.x, null);
                    newEdgeTrace.y.push(fromNode.y, toNode.y, null);
                    newEdgeTrace.z.push(fromNode.z, toNode.z, null);
                }
            });

            Plotly.newPlot('graph', [newEdgeTrace, {
                x: finalNodes.map(node => node.x),
                y: finalNodes.map(node => node.y),
                z: finalNodes.map(node => node.z),
                text: finalNodes.map(node => node.text),
                mode: 'markers+text',
                marker: {
                    size: 10,
                    color: finalNodes.map(node => node.color),
                    colorscale: 'YlGnBu',
                    colorbar: {
                        title: {
                            text: 'Frequency to target word',
                        },
                        len: 0.8
                    }
                },
                type: 'scatter3d'
            }], initialLayout);
        }
    });
}

function toggleGraphFunction() {
    const checkbox = document.getElementById('directConnectionsCheckbox');
    const button = document.getElementById('generateBtn');
    
    if (checkbox.checked) {
        button.setAttribute('onclick', 'generateOldGraph()');
    } else {
        button.setAttribute('onclick', 'generateGraph()');
    }
}

function generateProbabilityGraph() {
    const targetWord = document.getElementById('targetWord').value;
    const selectedNeighbor = getSelectedNeighbor();
    const contextWindowSize = parseInt(document.getElementById('contextWindowSize').value);
    const tokens = getTokensForAllData();

    const totalTokens = tokens.length;
    const positionCounts = Array(contextWindowSize * 2 + 1).fill(0);

    for (let i = 0; i < totalTokens; i++) {
        if (tokens[i] === targetWord) {
            const start = Math.max(i - contextWindowSize, 0);
            const end = Math.min(i + contextWindowSize + 1, totalTokens);

            for (let j = start; j < end; j++) {
                if (tokens[j] === selectedNeighbor && j !== i) {
                    const relativePosition = j - i + contextWindowSize;
                    positionCounts[relativePosition]++;
                }
            }
        }
    }

    const xValues = Array.from({ length: contextWindowSize * 2 + 1 }, (_, idx) => idx - contextWindowSize);

    const trace = {
        x: xValues,
        y: positionCounts,
        type: 'line'
    };

    const layout = {
        title: `Count of "${selectedNeighbor}" Around "${targetWord}"`,
        xaxis: { title: 'Position Relative to Target Word' },
        yaxis: { title: 'Count' }
    };

    Plotly.newPlot('probabilityGraph', [trace], layout);
}

document.getElementById('calculatePMIButton').addEventListener('click', displayPMI);
document.getElementById('calculateProbabilityGraph').addEventListener('click', generateProbabilityGraph);

function generateOldGraph() {
    const targetWord = document.getElementById('targetWord').value;
    const contextWindowSize = parseInt(document.getElementById('contextWindowSize').value);
    const topWordsCount = parseInt(document.getElementById('topWordsCount').value);
    const neighborsCount = parseInt(document.getElementById('neighborsCount').value);
    const commonWords = getCommonWords();

    const neighborWeight = parseFloat(document.getElementById('neighborWeight').value);
    const targetProximityStrength = parseFloat(document.getElementById('targetProximityStrength').value);

    const fullText = data.map(item => item.fullText).join(' ');
    tokens = fullText.toLowerCase().split(/\W+/);

    tokens = tokens.filter(word => !commonWords.has(word));

    const relatedWords = [];
    const neighborsDict = {};

    tokens.forEach((word, i) => {
        if (word === targetWord) {
            const start = Math.max(i - contextWindowSize, 0);
            const end = Math.min(i + contextWindowSize + 1, tokens.length);
            const context = tokens.slice(start, i).concat(tokens.slice(i + 1, end));
            relatedWords.push(...context);

            context.forEach(relatedWord => {
                if (!neighborsDict[relatedWord]) {
                    neighborsDict[relatedWord] = [];
                }
                neighborsDict[relatedWord].push(...context.filter(w => w !== relatedWord));
            });
        }
    });

    const wordFreq = {};
    relatedWords.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    const topWords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topWordsCount);

    populateNeighborSelect(topWords);

    const G = new Map();
    G.set(targetWord, wordFreq[targetWord] || 1);

    const edges = [];

    topWords.forEach(([word, freq]) => {
        G.set(word, freq);
        edges.push([targetWord, word]);
    
        if (neighborsDict[word]) {
            const neighbors = Object.entries(neighborsDict[word].reduce((acc, w) => {
                acc[w] = (acc[w] || 0) + 1;
                return acc;
            }, {}))
            .sort((a, b) => b[1] - a[1])
            .slice(0, neighborsCount);
    
            neighbors.forEach(([neighbor, neighborFreq]) => {
                if (!G.has(neighbor)) {
                    G.set(neighbor, neighborFreq);
                }
                if (neighborsDict[neighbor].includes(word)) {
                    edges.push([word, neighbor]);
                }
            });
        }
    });

    const maxFreq = Math.max(...Array.from(G.values()));

    const nodes = [];
    const nodeMap = new Map();

    G.forEach((size, word) => {
        const directFrequency = wordFreq[word] || 0;
        const targetProximity = Math.pow(1 - (size / maxFreq), targetProximityStrength / 4);
        const connectedEdges = edges.filter(edge => edge.includes(word)).length;
        let neighborProximity = Math.pow(connectedEdges, -neighborWeight);
        const combinedProximity = (targetProximity * (1 - neighborWeight)) + (neighborProximity * neighborWeight);
    
        const scale = 10;
        const node = {
            x: (Math.random() - 0.5) * combinedProximity * scale,
            y: (Math.random() - 0.5) * combinedProximity * scale,
            z: (Math.random() - 0.5) * combinedProximity * scale,
            text: word === targetWord ? word : `${word}: ${directFrequency}`,
            size: 10,
            word: word,
            color: size
        };
        nodes.push(node);
        nodeMap.set(word, node);
    });

    const targetNode = nodeMap.get(targetWord);
    if (targetNode) {
        targetNode.x = 0.5;
        targetNode.y = 0.5;
        targetNode.z = 0.5;
    }

    initialNodes = nodes.map(node => ({ ...node }));
    initialEdges = [...edges];

    const xValues = nodes.map(node => node.x);
    const yValues = nodes.map(node => node.y);
    const zValues = nodes.map(node => node.z);

    const xRange = [Math.min(...xValues) - 1, Math.max(...xValues) + 1];
    const yRange = [Math.min(...yValues) - 1, Math.max(...yValues) + 1];
    const zRange = [Math.min(...zValues) - 1, Math.max(...zValues) + 1];

    const minRange = [-5, 5];
    const adjustedXRange = [
        Math.min(minRange[0], xRange[0]),
        Math.max(minRange[1], xRange[1])
    ];
    const adjustedYRange = [
        Math.min(minRange[0], yRange[0]),
        Math.max(minRange[1], yRange[1])
    ];
    const adjustedZRange = [
        Math.min(minRange[0], zRange[0]),
        Math.max(minRange[1], zRange[1])
    ];

    initialLayout = {
        title: `  `,
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
            xaxis: { range: adjustedXRange, showbackground: false },
            yaxis: { range: adjustedYRange, showbackground: false },
            zaxis: { range: adjustedZRange, showbackground: false }
        },
        showlegend: false
    };

    const nodeTrace = {
        x: nodes.map(node => node.x),
        y: nodes.map(node => node.y),
        z: nodes.map(node => node.z),
        text: nodes.map(node => node.text),
        mode: 'markers+text',
        marker: {
            size: 10,
            color: nodes.map(node => node.color),
            colorscale: 'YlGnBu',
            colorbar: {
                title: {
                    text: 'Frequency to target word',
                },
                len: 0.8
            }
        },
        type: 'scatter3d',
        clickmode: 'event+select'
    };

    const edgeTrace = {
        x: [],
        y: [],
        z: [],
        mode: 'lines',
        line: {
            width: 0.5,
            color: '#888'
        },
        type: 'scatter3d'
    };

    edges.forEach(([from, to]) => {
        const fromNode = nodeMap.get(from);
        const toNode = nodeMap.get(to);
        if (fromNode && toNode) {
            edgeTrace.x.push(fromNode.x, toNode.x, null);
            edgeTrace.y.push(fromNode.y, toNode.y, null);
            edgeTrace.z.push(fromNode.z, toNode.z, null);
        }
    });

    Plotly.newPlot('graph', [edgeTrace, nodeTrace], initialLayout);

    document.getElementById('graph').on('plotly_click', function(data) {
        if (data.points[0].curveNumber === 1) {
            const clickedNode = data.points[0].text.split(':')[0];
            const clickedEdges = initialEdges.filter(edge => edge.includes(clickedNode));
            const neighborNodes = new Set();

            clickedEdges.forEach(([from, to]) => {
                if (from !== targetWord && from !== clickedNode) neighborNodes.add(from);
                if (to !== targetWord && to !== clickedNode) neighborNodes.add(to);
            });

            const filteredEdges = clickedEdges.filter(edge => 
                edge.includes(targetWord) || edge.includes(clickedNode)
            );

            const filteredNodes = [targetWord, clickedNode, ...neighborNodes];
            const newNodes = initialNodes.filter(node => filteredNodes.includes(node.word));
            const newEdges = [];

            filteredEdges.forEach(([from, to]) => {
                const fromNode = nodeMap.get(from);
                const toNode = nodeMap.get(to);
                if (fromNode && toNode) {
                    newEdges.push([fromNode, toNode]);
                }
            });

            const newEdgeTrace = {
                x: [],
                y: [],
                z: [],
                mode: 'lines',
                line: {
                    width: 0.5,
                    color: '#888'
                },
                type: 'scatter3d'
            };

            newEdges.forEach(([fromNode, toNode]) => {
                newEdgeTrace.x.push(fromNode.x, toNode.x, null);
                newEdgeTrace.y.push(fromNode.y, toNode.y, null);
                newEdgeTrace.z.push(fromNode.z, toNode.z, null);
            });

            Plotly.newPlot('graph', [newEdgeTrace, {
                x: newNodes.map(node => node.x),
                y: newNodes.map(node => node.y),
                z: newNodes.map(node => node.z),
                text: newNodes.map(node => node.text),
                mode: 'markers+text',
                marker: {
                    size: 10,
                    color: newNodes.map(node => node.color),
                    colorscale: 'YlGnBu',
                    colorbar: {
                        title: {
                            text: 'Frequency to target word',
                        },
                        len: 0.8
                    }
                },
                type: 'scatter3d'
            }], initialLayout);
        }
    });
}
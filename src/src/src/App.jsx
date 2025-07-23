
import React, { useState, useCallback, useMemo } from 'react';
import { Upload, FileSpreadsheet, BarChart3, TrendingUp, Users, Target, Calendar, Download, Eye, Settings } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import * as XLSX from 'xlsx';

const ICFActivityAnalyzer = () => {
  const [files, setFiles] = useState({
    mosaico: null,
    newTeam: null
  });
  const [data, setData] = useState({
    mosaico: [],
    newTeam: []
  });
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewMode, setViewMode] = useState('both'); // 'both', 'aggregated', 'mosaico', 'newteam'

  // Processa il file Excel con la struttura dell'utente (multi-foglio)
  const processUserExcelFile = useCallback(async (file, center) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      console.log(`Fogli trovati: ${workbook.SheetNames.join(', ')}`);
      
      let allProcessedData = [];
      
      // Mappa le aree
      const areaMapping = {
        'Area Personale': 'PERSONALE',
        'Area Relazionale': 'RELAZIONALE', 
        'Area Occupazionale': 'OCCUPAZIONALE',
        'Area Sociale': 'SOCIALE'
      };
      
      // Processa ogni foglio
      for (const sheetName of workbook.SheetNames) {
        console.log(`Processando foglio: ${sheetName}`);
        
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
        
        if (jsonData.length < 5) continue;
        
        const area = areaMapping[sheetName] || sheetName;
        let currentMacroarea = '';
        let currentCapitolo = '';
        let currentAttivita = '';
        let currentIndicatore = '';
        
        // Processa ogni riga
        for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
          const row = jsonData[rowIndex] || [];
          
          // Identifica macroarea (colonna B con "Macroarea")
          if (row[1] && typeof row[1] === 'string' && row[1].includes('Macroarea')) {
            currentMacroarea = row[1].replace('Macroarea dell\'', '').replace('Macroarea del ', '').trim();
            currentMacroarea = currentMacroarea.split(':')[0].trim().toUpperCase();
            if (currentMacroarea.includes('ESSERE')) currentMacroarea = 'ESSERE';
            else if (currentMacroarea.includes('APPARTENERE')) currentMacroarea = 'APPARTENERE';
            else if (currentMacroarea.includes('DIVENIRE')) currentMacroarea = 'DIVENIRE';
            continue;
          }
          
          // Identifica capitolo (colonna C con "Capitolo")
          if (row[2] && typeof row[2] === 'string' && row[2].includes('Capitolo')) {
            currentCapitolo = row[2].replace('Capitolo ', '').trim().toUpperCase();
            continue;
          }
          
          // Identifica attività (colonna D lunga)
          if (row[3] && typeof row[3] === 'string' && row[3].length > 50) {
            currentAttivita = row[3].substring(0, 50) + '...';
            continue;
          }
          
          // Identifica indicatore (colonna E con "L'utente sarà in grado")
          if (row[4] && typeof row[4] === 'string' && row[4].includes('utente sarà in grado')) {
            currentIndicatore = row[4].trim();
            continue;
          }
          
          // Identifica riga utente (colonna F con nome)
          if (row[5] && typeof row[5] === 'string' && row[5].trim() !== '' && 
              !row[5].includes('UTENTE PARTECIPANTE') && !row[5].includes('grado')) {
            
            const utente = row[5].trim();
            
            // Processa le valutazioni mensili (colonne G-R = indici 6-17)
            for (let mese = 1; mese <= 12; mese++) {
              const valutazione = row[5 + mese]; // colonna G=6, H=7, etc.
              
              if (valutazione !== null && valutazione !== undefined && valutazione !== '') {
                const numericValue = parseFloat(valutazione);
                
                if (!isNaN(numericValue) && numericValue > 0) {
                  allProcessedData.push({
                    area: area,
                    macroarea: currentMacroarea || 'NON SPECIFICATA',
                    capitolo: currentCapitolo || 'NON SPECIFICATO',
                    attivita: currentAttivita || 'NON SPECIFICATA',
                    indicatore: currentIndicatore || 'NON SPECIFICATO',
                    utente: utente,
                    valutazione: numericValue,
                    mediaSingoloUtente: parseFloat(row[18]) || numericValue, // colonna S
                    numeroPartecipanti: parseInt(row[19]) || 1, // colonna T
                    mediaNumeroCampioni: parseFloat(row[20]) || numericValue, // colonna U
                    mese: mese,
                    centro: center,
                    foglio: sheetName
                  });
                }
              }
            }
          }
        }
      }
      
      console.log(`Processati ${allProcessedData.length} record dal file ${center}`);
      
      if (allProcessedData.length === 0) {
        throw new Error('Nessun dato valido trovato nel file. Verifica la struttura.');
      }
      
      // Log di debug per vedere alcuni record
      console.log('Primi 5 record processati:', allProcessedData.slice(0, 5));
      
      setData(prev => ({
        ...prev,
        [center]: allProcessedData
      }));

      alert(`✅ File caricato con successo! 
      
📊 Statistiche:
- ${allProcessedData.length} valutazioni totali
- ${[...new Set(allProcessedData.map(d => d.utente))].length} utenti unici
- ${[...new Set(allProcessedData.map(d => d.attivita))].length} attività diverse
- ${workbook.SheetNames.length} aree analizzate
      
Fogli processati: ${workbook.SheetNames.join(', ')}`);

    } catch (error) {
      console.error('Errore nel processare il file:', error);
      alert(`❌ Errore nel caricamento del file: ${error.message}
      
🔧 Il file è stato riconosciuto come struttura multi-foglio, ma si è verificato un problema durante l'elaborazione.
      
Dettagli tecnici disponibili nella console del browser (F12).`);
    }
  }, []);

  const handleFileUpload = useCallback((event, center) => {
    const file = event.target.files[0];
    if (file && file.type.includes('sheet')) {
      setFiles(prev => ({ ...prev, [center]: file }));
      // Usa la nuova funzione per la struttura multi-foglio dell'utente
      processUserExcelFile(file, center);
    }
  }, [processUserExcelFile]);

  // Calcola le statistiche individuali per un utente specifico
  const calculateUserStats = useCallback((activityData, userName) => {
    const userData = activityData.filter(d => d.utente === userName);
    if (!userData || userData.length === 0) return null;

    const userCenter = userData[0].centro === 'mosaico' ? 'Centro Mosaico' : 'New Team Mosaico';
    const indicators = [...new Set(userData.map(d => d.indicatore))];
    
    // Calcola il trend mensile per l'utente
    const monthlyData = {};
    userData.forEach(d => {
      if (!monthlyData[d.mese]) monthlyData[d.mese] = [];
      monthlyData[d.mese].push(d.valutazione);
    });
    
    const monthlyAvgs = Object.keys(monthlyData).map(month => ({
      month: parseInt(month),
      avg: monthlyData[month].reduce((sum, val) => sum + val, 0) / monthlyData[month].length,
      scores: monthlyData[month]
    })).sort((a, b) => a.month - b.month);

    // Calcola statistiche per indicatore
    const indicatorStats = indicators.map(indicator => {
      const indicatorData = userData.filter(d => d.indicatore === indicator);
      const avgScore = indicatorData.reduce((sum, d) => sum + d.valutazione, 0) / indicatorData.length;
      
      // Trend mensile per questo indicatore
      const indicatorMonthlyData = {};
      indicatorData.forEach(d => {
        if (!indicatorMonthlyData[d.mese]) indicatorMonthlyData[d.mese] = [];
        indicatorMonthlyData[d.mese].push(d.valutazione);
      });
      
      const indicatorMonthlyAvgs = Object.keys(indicatorMonthlyData).map(month => ({
        month: parseInt(month),
        avg: indicatorMonthlyData[month].reduce((sum, val) => sum + val, 0) / indicatorMonthlyData[month].length
      })).sort((a, b) => a.month - b.month);

      // Calcola il miglioramento per questo indicatore
      const firstMonth = indicatorMonthlyAvgs[0]?.avg || 0;
      const lastMonth = indicatorMonthlyAvgs[indicatorMonthlyAvgs.length - 1]?.avg || 0;
      const improvement = lastMonth - firstMonth;

      return {
        indicator,
        avgScore: avgScore.toFixed(2),
        improvement: improvement.toFixed(2),
        improvementPercentage: firstMonth > 0 ? ((improvement / firstMonth) * 100).toFixed(1) : '0.0',
        monthlyTrend: indicatorMonthlyAvgs,
        totalSessions: indicatorData.length
      };
    });

    // Calcola miglioramento complessivo dell'utente
    const overallAvg = userData.reduce((sum, d) => sum + d.valutazione, 0) / userData.length;
    const firstMonthAvg = monthlyAvgs[0]?.avg || 0;
    const lastMonthAvg = monthlyAvgs[monthlyAvgs.length - 1]?.avg || 0;
    const overallImprovement = lastMonthAvg - firstMonthAvg;

    return {
      userName,
      userCenter,
      totalSessions: userData.length,
      overallAverage: overallAvg.toFixed(2),
      overallImprovement: overallImprovement.toFixed(2),
      overallImprovementPercentage: firstMonthAvg > 0 ? ((overallImprovement / firstMonthAvg) * 100).toFixed(1) : '0.0',
      monthsParticipated: monthlyAvgs.length,
      monthlyTrend: monthlyAvgs,
      indicatorStats,
      firstMonth: Math.min(...userData.map(d => d.mese)),
      lastMonth: Math.max(...userData.map(d => d.mese))
    };
  }, []);

  // Calcola le statistiche per una specifica attività
  const calculateActivityStats = useCallback((activityData) => {
    if (!activityData || activityData.length === 0) return null;

    const uniqueParticipants = [...new Set(activityData.map(d => d.utente))];
    const participantsList = uniqueParticipants.filter(name => name && name.trim() !== '');
    const indicators = [...new Set(activityData.map(d => d.indicatore))];
    
    // Analizza la distribuzione per centro
    const centerDistribution = {};
    activityData.forEach(d => {
      const centerName = d.centro === 'mosaico' ? 'Centro Mosaico' : 'New Team Mosaico';
      if (!centerDistribution[centerName]) {
        centerDistribution[centerName] = {
          participants: new Set(),
          count: 0
        };
      }
      centerDistribution[centerName].participants.add(d.utente);
      centerDistribution[centerName].count++;
    });

    // Converti i Set in array per il conteggio
    Object.keys(centerDistribution).forEach(center => {
      centerDistribution[center].participantsList = [...centerDistribution[center].participants].filter(name => name && name.trim() !== '');
      centerDistribution[center].participantsCount = centerDistribution[center].participantsList.length;
    });
    
    const indicatorStats = indicators.map(indicator => {
      const indicatorData = activityData.filter(d => d.indicatore === indicator);
      const participantsForIndicator = [...new Set(indicatorData.map(d => d.utente))].filter(name => name && name.trim() !== '');
      const avgScore = indicatorData.reduce((sum, d) => sum + d.valutazione, 0) / indicatorData.length;
      
      // Analizza la distribuzione per centro per questo indicatore
      const indicatorCenterDistribution = {};
      indicatorData.forEach(d => {
        const centerName = d.centro === 'mosaico' ? 'Centro Mosaico' : 'New Team Mosaico';
        if (!indicatorCenterDistribution[centerName]) {
          indicatorCenterDistribution[centerName] = new Set();
        }
        indicatorCenterDistribution[centerName].add(d.utente);
      });

      Object.keys(indicatorCenterDistribution).forEach(center => {
        indicatorCenterDistribution[center] = [...indicatorCenterDistribution[center]].filter(name => name && name.trim() !== '');
      });
      
      // Calcola il trend mensile
      const monthlyData = {};
      indicatorData.forEach(d => {
        if (!monthlyData[d.mese]) monthlyData[d.mese] = [];
        monthlyData[d.mese].push(d.valutazione);
      });
      
      const monthlyAvgs = Object.keys(monthlyData).map(month => ({
        month: parseInt(month),
        avg: monthlyData[month].reduce((sum, val) => sum + val, 0) / monthlyData[month].length
      })).sort((a, b) => a.month - b.month);

      return {
        indicator,
        participants: participantsForIndicator.length,
        participantsList: participantsForIndicator,
        centerDistribution: indicatorCenterDistribution,
        avgScore: avgScore.toFixed(2),
        monthlyTrend: monthlyAvgs
      };
    });

    const overallAvg = activityData.reduce((sum, d) => sum + d.valutazione, 0) / activityData.length;
    
    // Valuta il miglioramento dal primo mese
    const firstMonth = Math.min(...activityData.map(d => d.mese));
    const lastMonth = Math.max(...activityData.map(d => d.mese));
    
    const firstMonthData = activityData.filter(d => d.mese === firstMonth);
    const lastMonthData = activityData.filter(d => d.mese === lastMonth);
    
    const firstMonthAvg = firstMonthData.reduce((sum, d) => sum + d.valutazione, 0) / firstMonthData.length;
    const lastMonthAvg = lastMonthData.reduce((sum, d) => sum + d.valutazione, 0) / lastMonthData.length;
    
    const improvement = lastMonthAvg - firstMonthAvg;

    return {
      activityName: activityData[0].attivita,
      area: activityData[0].area,
      macroarea: activityData[0].macroarea,
      capitolo: activityData[0].capitolo,
      totalParticipants: participantsList.length,
      participantsList: participantsList,
      centerDistribution: centerDistribution,
      overallAverage: overallAvg.toFixed(2),
      indicatorStats,
      improvement: improvement.toFixed(2),
      improvementPercentage: ((improvement / firstMonthAvg) * 100).toFixed(1),
      totalMonths: lastMonth - firstMonth + 1
    };
  }, []);

  // Genera il report interpretativo
  const generateInterpretativeReport = useCallback((stats) => {
    if (!stats) return '';

    const improvementText = parseFloat(stats.improvement) > 0 
      ? `ha mostrato un miglioramento significativo di ${stats.improvement} punti (${stats.improvementPercentage}%)`
      : parseFloat(stats.improvement) < 0 
        ? `ha registrato una diminuzione di ${Math.abs(stats.improvement)} punti (${Math.abs(stats.improvementPercentage)}%)`
        : 'ha mantenuto prestazioni stabili';

    // Analisi della distribuzione per centro
    const centerInfo = Object.keys(stats.centerDistribution).map(center => 
      `${center}: ${stats.centerDistribution[center].participantsCount} partecipanti`
    ).join(', ');

    const centerDetails = Object.keys(stats.centerDistribution).length > 1 
      ? ` I partecipanti sono distribuiti tra i centri come segue: ${centerInfo}.`
      : ` L'attività è stata svolta presso ${Object.keys(stats.centerDistribution)[0]} con ${stats.totalParticipants} partecipanti.`;

    let indicatorAnalysis = '';
    if (stats.indicatorStats.length > 1) {
      const bestIndicator = stats.indicatorStats.reduce((best, current) => 
        parseFloat(current.avgScore) > parseFloat(best.avgScore) ? current : best
      );
      indicatorAnalysis = ` L'indicatore "${bestIndicator.indicator}" ha ottenuto i migliori risultati con una media di ${bestIndicator.avgScore} punti e ${bestIndicator.participants} partecipanti.`;
    }

    return `L'attività "${stats.activityName}" nell'area ${stats.area} (${stats.macroarea}) ${improvementText} nel corso di ${stats.totalMonths} mesi di osservazione.${centerDetails}
    
Con una media complessiva di ${stats.overallAverage} punti, l'attività dimostra ${parseFloat(stats.improvement) > 0 ? 'un\'efficacia positiva' : parseFloat(stats.improvement) < 0 ? 'necessità di revisione degli approcci' : 'stabilità negli outcome'} nell'intervento proposto.${indicatorAnalysis}

Questo andamento ${parseFloat(stats.improvement) > 0 ? 'conferma' : 'suggerisce di rivedere'} l'allineamento tra progetto personalizzato e attività di gruppo, evidenziando ${parseFloat(stats.improvement) > 0 ? 'l\'efficacia' : 'l\'opportunità di miglioramento'} dell'intervento nell'ambito della qualità di vita secondo il modello ICF.`;
  }, []);

  // Ottieni tutte le attività uniche
  const uniqueActivities = useMemo(() => {
    let allData = [];
    
    switch(viewMode) {
      case 'mosaico':
        allData = data.mosaico || [];
        break;
      case 'newteam':
        allData = data.newTeam || [];
        break;
      case 'aggregated':
        allData = [...(data.mosaico || []), ...(data.newTeam || [])];
        break;
      default: // 'both'
        allData = [...(data.mosaico || []), ...(data.newTeam || [])];
        break;
    }
    
    const activities = {};
    allData.forEach(item => {
      const key = `${item.area}_${item.attivita}`;
      if (!activities[key]) {
        activities[key] = {
          area: item.area,
          macroarea: item.macroarea,
          capitolo: item.capitolo,
          attivita: item.attivita,
          data: []
        };
      }
      activities[key].data.push(item);
    });
    
    return Object.values(activities);
  }, [data, viewMode]);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Analizzatore Attività ICF - Centri Diurni per la Disabilità
              </h1>
              <p className="text-gray-600">
                Analisi delle attività secondo il modello di Brown et al. e componenti ICF
              </p>
            </div>
            <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg text-sm font-medium">
              ✅ Configurato per la tua struttura Excel
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">🎯 App Personalizzata!</h3>
            <p className="text-blue-700 text-sm">
              L'app è stata adattata per leggere direttamente la tua struttura Excel multi-foglio con le 4 aree 
              (Personale, Relazionale, Occupazionale, Sociale). Carica i tuoi file e l'analisi inizierà automaticamente!
            </p>
          </div>
        </div>

        {/* Upload Files */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-500" />
              Centro Mosaico
            </h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e, 'mosaico')}
                className="hidden"
                id="mosaico-upload"
              />
              <label htmlFor="mosaico-upload" className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-800">Carica file Excel</span>
              </label>
              {files.mosaico && (
                <p className="text-sm text-green-600 mt-2">✓ {files.mosaico.name}</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-500" />
              New Team Mosaico
            </h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e, 'newTeam')}
                className="hidden"
                id="newteam-upload"
              />
              <label htmlFor="newteam-upload" className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-800">Carica file Excel</span>
              </label>
              {files.newTeam && (
                <p className="text-sm text-green-600 mt-2">✓ {files.newTeam.name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Come utilizzare l'applicazione personalizzata</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-lg mb-3 text-green-600">📥 1. Carica i tuoi file Excel</h3>
              <div className="space-y-2 text-gray-700 text-sm">
                <p>• <strong>Usa i tuoi file attuali</strong> - l'app è configurata per la tua struttura</p>
                <p>• <strong>File multi-foglio</strong> - con Area Personale, Relazionale, Occupazionale, Sociale</p>
                <p>• <strong>Struttura riconosciuta</strong> - utenti in colonna F, valutazioni mensili in G-R</p>
                <p>• <strong>Carica entrambi i centri</strong> - Mosaico e New Team separatamente</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-3 text-blue-600">📊 2. Esplora i risultati</h3>
              <div className="space-y-2 text-gray-700 text-sm">
                <p>• <strong>Scegli la modalità</strong> di visualizzazione (centri separati o aggregati)</p>
                <p>• <strong>Clicca su un'attività</strong> per l'analisi dettagliata</p>
                <p>• <strong>Clicca su un utente</strong> per i suoi progressi individuali</p>
                <p>• <strong>Consulta i report</strong> interpretativi automatici</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-orange-50 rounded-lg">
            <p className="text-orange-800 text-sm">
              <strong>🎉 App Personalizzata:</strong> L'applicazione è stata configurata specificatamente per la tua 
              struttura Excel multi-foglio. Carica i tuoi file attuali senza modifiche - l'app riconoscerà 
              automaticamente le 4 aree, gli utenti, gli indicatori e le valutazioni mensili!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ICFActivityAnalyzer;

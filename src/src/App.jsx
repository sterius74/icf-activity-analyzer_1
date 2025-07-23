import React, { useState, useCallback, useMemo } from 'react';
import { Upload, FileSpreadsheet, BarChart3, TrendingUp, Users, Target, Calendar, Eye, Settings } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
  const [viewMode, setViewMode] = useState('both');

  const processUserExcelFile = useCallback(async (file, center) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      let allProcessedData = [];
      
      const areaMapping = {
        'Area Personale': 'PERSONALE',
        'Area Relazionale': 'RELAZIONALE', 
        'Area Occupazionale': 'OCCUPAZIONALE',
        'Area Sociale': 'SOCIALE'
      };
      
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
        
        if (jsonData.length < 5) continue;
        
        const area = areaMapping[sheetName] || sheetName;
        let currentMacroarea = '';
        let currentCapitolo = '';
        let currentAttivita = '';
        let currentIndicatore = '';
        
        for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
          const row = jsonData[rowIndex] || [];
          
          if (row[1] && typeof row[1] === 'string' && row[1].includes('Macroarea')) {
            currentMacroarea = row[1].replace('Macroarea dell\'', '').replace('Macroarea del ', '').trim();
            currentMacroarea = currentMacroarea.split(':')[0].trim().toUpperCase();
            if (currentMacroarea.includes('ESSERE')) currentMacroarea = 'ESSERE';
            else if (currentMacroarea.includes('APPARTENERE')) currentMacroarea = 'APPARTENERE';
            else if (currentMacroarea.includes('DIVENIRE')) currentMacroarea = 'DIVENIRE';
            continue;
          }
          
          if (row[2] && typeof row[2] === 'string' && row[2].includes('Capitolo')) {
            currentCapitolo = row[2].replace('Capitolo ', '').trim().toUpperCase();
            continue;
          }
          
          if (row[3] && typeof row[3] === 'string' && row[3].length > 50) {
            currentAttivita = row[3].substring(0, 50) + '...';
            continue;
          }
          
          if (row[4] && typeof row[4] === 'string' && row[4].includes('utente sarà in grado')) {
            currentIndicatore = row[4].trim();
            continue;
          }
          
          if (row[5] && typeof row[5] === 'string' && row[5].trim() !== '' && 
              !row[5].includes('UTENTE PARTECIPANTE') && !row[5].includes('grado')) {
            
            const utente = row[5].trim();
            
            for (let mese = 1; mese <= 12; mese++) {
              const valutazione = row[5 + mese];
              
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
                    mediaSingoloUtente: parseFloat(row[18]) || numericValue,
                    numeroPartecipanti: parseInt(row[19]) || 1,
                    mediaNumeroCampioni: parseFloat(row[20]) || numericValue,
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
      
      if (allProcessedData.length === 0) {
        throw new Error('Nessun dato valido trovato nel file.');
      }
      
      setData(prev => ({
        ...prev,
        [center]: allProcessedData
      }));

      alert(`✅ File caricato con successo! ${allProcessedData.length} valutazioni processate.`);

    } catch (error) {
      alert(`❌ Errore: ${error.message}`);
    }
  }, []);

  const handleFileUpload = useCallback((event, center) => {
    const file = event.target.files[0];
    if (file && file.type.includes('sheet')) {
      setFiles(prev => ({ ...prev, [center]: file }));
      processUserExcelFile(file, center);
    }
  }, [processUserExcelFile]);

  const uniqueActivities = useMemo(() => {
    let allData = [];
    
    switch(viewMode) {
      case 'mosaico':
        allData = data.mosaico || [];
        break;
      case 'newteam':
        allData = data.newTeam || [];
        break;
      default:
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

        {uniqueActivities.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">
              Attività Analizzate ({uniqueActivities.length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uniqueActivities.map((activity, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 border">
                  <h3 className="font-semibold text-gray-800">{activity.attivita}</h3>
                  <p className="text-sm text-gray-600">{activity.area} • {activity.macroarea}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.data.length} valutazioni</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {uniqueActivities.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Come utilizzare l'applicazione</h2>
            <p className="text-gray-700 mb-4">
              Carica i file Excel dei tuoi centri diurni per iniziare l'analisi delle attività ICF.
            </p>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-orange-800 text-sm">
                <strong>🎉 App Personalizzata:</strong> L'applicazione è configurata per la tua struttura Excel multi-foglio.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ICFActivityAnalyzer;

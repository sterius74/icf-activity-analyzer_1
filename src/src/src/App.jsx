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

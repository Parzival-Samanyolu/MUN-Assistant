import React, { useState, useCallback } from 'react';
import { Source } from '../types';
import PDFLayout from './PDFLayout';

interface ExportPDFButtonProps {
  country: string;
  topic: string;
  summary: string;
  sources: Source[];
  flagUrl: string | null;
  disabled: boolean;
}

const ExportPDFButton: React.FC<ExportPDFButtonProps> = ({ country, topic, summary, sources, flagUrl, disabled }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (isExporting || disabled) return;

    setIsExporting(true);

    try {
      // Dynamically import heavy libraries
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const ReactDOM = await import('react-dom/client');

      // Create a temporary container for rendering the PDF content
      const pdfContainer = document.createElement('div');
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.top = '0';
      // A4 width in pixels at 96 DPI is approx 794px. Let's give it a bit of room.
      pdfContainer.style.width = '800px'; 
      document.body.appendChild(pdfContainer);
      
      // Render the React component into the temporary container
      const root = ReactDOM.createRoot(pdfContainer);
      root.render(
        <React.StrictMode>
            <PDFLayout
                country={country}
                topic={topic}
                summary={summary}
                sources={sources}
                flagUrl={flagUrl}
            />
        </React.StrictMode>
      );
      
      // Wait for the content to be rendered and images to load
      await new Promise(resolve => {
        const images = pdfContainer.getElementsByTagName('img');
        const totalImages = images.length;

        if (totalImages === 0) {
          setTimeout(resolve, 100); // Wait for text rendering
          return;
        }

        let loadedImages = 0;
        const onImageLoaded = () => {
          loadedImages++;
          if (loadedImages === totalImages) {
            setTimeout(resolve, 100); // Give it a moment to paint
          }
        };

        Array.from(images).forEach(img => {
          if (img.complete) {
            // Already loaded (e.g., from cache)
            loadedImages++;
          } else {
            img.addEventListener('load', onImageLoaded);
            img.addEventListener('error', onImageLoaded); // Count errors as loaded to not hang indefinitely
          }
        });

        if (loadedImages === totalImages) {
          setTimeout(resolve, 100);
        }
      });


      const canvas = await html2canvas(pdfContainer, {
        scale: 2, // Higher scale for better quality
        useCORS: true, // Important for external images like flags
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = canvasWidth / pdfWidth;
      const imgHeight = canvasHeight / ratio;
      
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Handle multi-page PDFs
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      // Sanitize filename
      const sanitizedCountry = country.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const sanitizedTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
      
      pdf.save(`MUN_Briefing_${sanitizedCountry}_${sanitizedTopic}.pdf`);
      
      // Cleanup
      root.unmount();
      document.body.removeChild(pdfContainer);

    } catch (error) {
        console.error("Failed to export PDF:", error);
        // Optionally, show an error to the user
    } finally {
        setIsExporting(false);
    }
  }, [country, topic, summary, sources, flagUrl, isExporting, disabled]);

  return (
    <button
      onClick={handleExport}
      disabled={disabled || isExporting}
      className="flex items-center text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-wait"
      title="Export briefing as PDF"
    >
      {isExporting ? (
        <>
            <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Exporting...
        </>
      ) : (
        <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export PDF
        </>
      )}
    </button>
  );
};

export default ExportPDFButton;
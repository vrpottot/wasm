import * as PIXI from 'pixi.js-legacy';
import type { CanvasKit } from '@rollerbird/canvaskit-wasm-pdf';
import { convertPixiContainerToSkia } from './renderer';

// Extend CanvasKit's type definitions to formally support the internal _rootTag metadata field
declare module '@rollerbird/canvaskit-wasm-pdf' {
  interface PDFMetadata {
    _rootTag?: any;
  }
}

/**
 * Exports the given PIXI.Container to a vector PDF file using the Skia PDF backend.
 */
export function exportSceneToPDF(
  container: PIXI.Container,
  width: number,
  height: number,
  canvaskit: CanvasKit
): void {
  try {
    // 1. Create a PDF Document with metadata
    const doc = canvaskit.MakePDFDocument({
      title: 'Pixi scene exported via Skia PDF Backend',
      author: 'Antigravity AI Developer',
      creator: 'Skia CanvasKit PDF backend',
      _rootTag: null
    });

    if (!doc) {
      throw new Error('Failed to create CanvasKit PDF Document. Check WASM configuration.');
    }

    // 2. Start page with exact dimensions
    const pdfCanvas = doc.beginPage(width, height);
    if (!pdfCanvas) {
      throw new Error('Failed to start PDF page.');
    }

    // 3. Render the PIXI container directly onto the PDF vector canvas
    convertPixiContainerToSkia(container, pdfCanvas, canvaskit);

    // 4. End page rendering
    doc.endPage();

    // 5. Close document and retrieve bytes
    const pdfDataBytes = doc.close();
    if (!pdfDataBytes || pdfDataBytes.length === 0) {
      throw new Error('PDF output bytes are empty.');
    }

    // 6. Create Blob and trigger download
    const blob = new Blob([pdfDataBytes as any], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.download = 'pixi-skia-export.pdf';
    document.body.appendChild(downloadLink);
    downloadLink.click();

    // Clean up
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(blobUrl);
    
    console.log('PDF export completed successfully. Size:', pdfDataBytes.length, 'bytes');
  } catch (error) {
    console.error('Error exporting scene to PDF:', error);
    alert('Ошибка при экспорте в PDF: ' + (error as Error).message);
  }
}

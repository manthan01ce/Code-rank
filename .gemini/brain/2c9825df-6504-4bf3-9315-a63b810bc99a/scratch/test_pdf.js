const { jsPDF } = require("jspdf");
require("jspdf-autotable");

async function testPdf() {
  try {
    const doc = new jsPDF();
    doc.text("Hello World", 10, 10);
    doc.autoTable({
      head: [['Header 1', 'Header 2']],
      body: [['Value 1', 'Value 2']]
    });
    const buffer = doc.output('arraybuffer');
    console.log("PDF generated successfully, buffer length:", buffer.byteLength);
  } catch (e) {
    console.error("PDF generation failed:", e);
  }
}

testPdf();

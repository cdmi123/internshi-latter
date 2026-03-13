import zipfile
import xml.etree.ElementTree as ET

def get_docx_text(path):
    word_namespace = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    para = word_namespace + 'p'
    text = word_namespace + 't'
    table = word_namespace + 'tbl'
    row = word_namespace + 'tr'
    cell = word_namespace + 'tc'

    try:
        document = zipfile.ZipFile(path)
        xml_content = document.read('word/document.xml')
        document.close()
        tree = ET.XML(xml_content)
        
        paragraphs = []
        for element in tree.iter():
            if element.tag == para:
                texts = [node.text for node in element.iter(text) if node.text]
                if texts:
                    paragraphs.append(''.join(texts))
            elif element.tag == table:
                paragraphs.append("--- TABLE ---")
                for tr in element.iter(row):
                    row_data = []
                    for tc in tr.iter(cell):
                        texts = [node.text for node in tc.iter(text) if node.text]
                        row_data.append(''.join(texts))
                    if any(row_data):
                        paragraphs.append(" | ".join(row_data))
                paragraphs.append("--- END TABLE ---")
        return '\n'.join(paragraphs)
    except Exception as e:
        return str(e)

print(get_docx_text(r"d:\Ravi Sir\Node js\Node js Project List\3. internship latter - Copy\Annexure 3 Evaluation (1).docx"))

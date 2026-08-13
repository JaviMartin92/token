const fs = require('fs');
const path = require('path');

const directoryPath = 'c:\\Users\\Admin\\Desktop\\token\\contracts\\src';

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  files.forEach(file => {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.sol')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      if (content.includes('Ownable')) {
        // Import replacements
        content = content.replace(/import "@openzeppelin\/contracts\/access\/Ownable.sol";/g, 'import "@openzeppelin/contracts/access/AccessControl.sol";\nimport "./ProtocolRoles.sol";');
        content = content.replace(/import "\.\/lib\/access\/Ownable\.sol";/g, 'import "@openzeppelin/contracts/access/AccessControl.sol";\nimport "./ProtocolRoles.sol";');
        content = content.replace(/import "\.\.\/lib\/access\/Ownable\.sol";/g, 'import "@openzeppelin/contracts/access/AccessControl.sol";\nimport "../ProtocolRoles.sol";');
        
        // is Ownable -> is AccessControl
        content = content.replace(/is Ownable,/g, 'is AccessControl,');
        content = content.replace(/is Ownable {/g, 'is AccessControl {');
        
        // onlyOwner -> onlyRole(ProtocolRoles.ADMIN_ROLE)
        content = content.replace(/onlyOwner/g, 'onlyRole(ProtocolRoles.ADMIN_ROLE)');
        
        // constructor(..., address _initialOwner) Ownable() { ... }
        // We will just remove Ownable() or Ownable(msg.sender) from constructor definition
        content = content.replace(/Ownable\([^)]*\)\s*/g, '');
        content = content.replace(/Ownable\(\)\s*/g, '');

        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  });
}

processDirectory(directoryPath);

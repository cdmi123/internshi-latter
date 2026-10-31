const branchAddresses = new Map([
    ['yogichowk', '401-402, 4th Floor, City Center Complex, Nr. Yogichowk, Varachha, Surat - 395010.'],
    ['katargam', '325-326, 3rd Floor, Laxmi Enclave, Opp. Gajera School, Katargam, Surat - 395004.'],
    ['adajan', '201, 2nd Floor, Mega Royal, Honey Park Cross Rd, Adajan, Surat-395009'],
    ['navsari', '201-208, 2nd Floor, Shree Madhav Business Hub, Nr. Bus Station, Opp. District Court, Navsari-396445']
]);

const getBranchAddress = (branch) => branchAddresses.get(branch) || branchAddresses.get('yogichowk');

module.exports = getBranchAddress;

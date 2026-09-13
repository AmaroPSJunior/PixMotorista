/**
 * Utility to generate standard Pix BR Code (EMV QRCPS) static payload.
 * Follows Banco Central do Brasil Pix specifications.
 */

function crc16CCITT(str: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < str.length; i++) {
    let byte = str.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      const bit = ((byte >> (7 - j)) & 1) === 1;
      const c15 = ((crc >> 15) & 1) === 1;
      crc <<= 1;
      if (c15 !== bit) {
        crc ^= polynomial;
      }
    }
  }

  crc &= 0xffff;
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatTLVD(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function sanitizeString(str: string, maxLen: number): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9 ]/g, '') // ASCII alphanumeric
    .toUpperCase()
    .trim()
    .substring(0, maxLen);
}

export function generatePixBRCodePayload(params: {
  pixKey: string;
  receiverName: string;
  city: string;
  amount?: number;
  txId?: string;
}): string {
  const { pixKey, receiverName, city, amount, txId = '***' } = params;

  const keyClean = pixKey.trim();
  const nameSanitized = sanitizeString(receiverName || 'MOTORISTA', 25) || 'MOTORISTA';
  const citySanitized = sanitizeString(city || 'SAO PAULO', 15) || 'SAO PAULO';

  // 00: Payload Format Indicator (01)
  const pfi = formatTLVD('00', '01');

  // 26: Merchant Account Info (GUI + Key)
  const gui = formatTLVD('00', 'br.gov.bcb.pix');
  const key = formatTLVD('01', keyClean);
  const merchantAccountInfo = formatTLVD('26', `${gui}${key}`);

  // 52: Merchant Category Code (0000 = general)
  const mcc = formatTLVD('52', '0000');

  // 53: Transaction Currency (986 = BRL)
  const currency = formatTLVD('53', '986');

  // 54: Transaction Amount (optional)
  let amountStr = '';
  if (amount && amount > 0) {
    amountStr = formatTLVD('54', amount.toFixed(2));
  }

  // 58: Country Code (BR)
  const country = formatTLVD('58', 'BR');

  // 59: Merchant Name
  const name = formatTLVD('59', nameSanitized);

  // 60: Merchant City
  const cityName = formatTLVD('60', citySanitized);

  // 62: Additional Data Field Template (txId)
  const additionalData = formatTLVD('62', formatTLVD('05', txId));

  // Combine before CRC
  const payloadBeforeCRC = `${pfi}${merchantAccountInfo}${mcc}${currency}${amountStr}${country}${name}${cityName}${additionalData}6304`;

  // Compute CRC16
  const checksum = crc16CCITT(payloadBeforeCRC);

  return `${payloadBeforeCRC}${checksum}`;
}

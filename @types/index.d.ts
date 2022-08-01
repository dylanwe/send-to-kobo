interface StoredInformation {
    created: Date;
    agent: string;
    file: any;
    alive?: Date;
    timer?: NodeJS.Timeout;
}

interface ConversionData {
    conversion: string,
    filename: string,
    data: any,
}
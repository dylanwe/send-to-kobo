interface FlashMessage {
    message: string,
    success: boolean,
    key?: string,
}

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
declare module "@payhere/payhere-mobilesdk-reactnative" {
  export interface PayHereNativeStartPaymentObject {
    sandbox: boolean;
    merchant_id: string;
    notify_url: string;
    order_id: string;
    items: string;
    amount: string;
    currency: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    custom_1?: string;
    custom_2?: string;
  }

  export interface PayHereMobileSdkModule {
    startPayment(
      paymentObject: PayHereNativeStartPaymentObject,
      onCompleted: (paymentId: string) => void,
      onError: (errorData: string) => void,
      onDismissed: () => void
    ): void;
  }

  const PayHere: PayHereMobileSdkModule;
  export default PayHere;
}


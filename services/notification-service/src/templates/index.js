const templates = {
  order_confirmation: (data) => ({
    subject: `Order Confirmed — #${data.orderId.slice(-8).toUpperCase()}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1D9E75;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:24px">Order Confirmed ✓</h1>
        </div>
        <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
          <p style="font-size:16px">Hi ${data.userName || 'there'},</p>
          <p>Your order has been confirmed and is being prepared.</p>
          <div style="background:#f9f9f9;padding:16px;border-radius:8px;margin:16px 0">
            <p style="margin:0"><strong>Order ID:</strong> ${data.orderId}</p>
            <p style="margin:8px 0 0"><strong>Total:</strong> $${data.total}</p>
            <p style="margin:8px 0 0"><strong>Status:</strong> Confirmed</p>
          </div>
          <h3>Items ordered:</h3>
          ${data.items?.map(item => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee">
              <span>${item.name} × ${item.quantity}</span>
              <span>$${item.price * item.quantity}</span>
            </div>
          `).join('') || ''}
          <p style="margin-top:24px;color:#666;font-size:14px">
            Thank you for shopping with NexCart!
          </p>
        </div>
      </div>
    `
  }),

  payment_succeeded: (data) => ({
    subject: `Payment Received — $${data.amount}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1D9E75;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0">Payment Successful ✓</h1>
        </div>
        <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
          <p>Your payment of <strong>$${data.amount}</strong> has been received.</p>
          <div style="background:#f9f9f9;padding:16px;border-radius:8px">
            <p style="margin:0"><strong>Order ID:</strong> ${data.orderId}</p>
            <p style="margin:8px 0 0"><strong>Amount:</strong> $${data.amount}</p>
          </div>
        </div>
      </div>
    `
  }),

  payment_failed: (data) => ({
    subject: `Payment Failed — Action Required`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#D85A30;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0">Payment Failed ✗</h1>
        </div>
        <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
          <p>Unfortunately your payment could not be processed.</p>
          <div style="background:#fff5f5;padding:16px;border-radius:8px;border:1px solid #fcc">
            <p style="margin:0"><strong>Order ID:</strong> ${data.orderId}</p>
            <p style="margin:8px 0 0"><strong>Reason:</strong> ${data.reason}</p>
          </div>
          <p style="margin-top:16px">Please try again with a different payment method.</p>
        </div>
      </div>
    `
  }),

  shipping_update: (data) => ({
    subject: `Your Order Has Been ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#378ADD;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0">Order Update 📦</h1>
        </div>
        <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
          <p>Your order status has been updated.</p>
          <div style="background:#f9f9f9;padding:16px;border-radius:8px">
            <p style="margin:0"><strong>Order ID:</strong> ${data.orderId}</p>
            <p style="margin:8px 0 0"><strong>New Status:</strong> 
              <span style="color:#1D9E75;font-weight:bold">${data.status.toUpperCase()}</span>
            </p>
            ${data.trackingNumber ? `<p style="margin:8px 0 0"><strong>Tracking:</strong> ${data.trackingNumber}</p>` : ''}
          </div>
        </div>
      </div>
    `
  }),

  low_stock_alert: (data) => ({
    subject: `⚠️ Low Stock Alert — ${data.productName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#BA7517;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0">Low Stock Alert ⚠️</h1>
        </div>
        <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
          <p>A product is running low on stock.</p>
          <div style="background:#fffbf0;padding:16px;border-radius:8px;border:1px solid #fde">
            <p style="margin:0"><strong>Product:</strong> ${data.productName}</p>
            <p style="margin:8px 0 0"><strong>Remaining:</strong> ${data.available} units</p>
            <p style="margin:8px 0 0"><strong>Threshold:</strong> ${data.threshold} units</p>
          </div>
          <p style="margin-top:16px">Please restock soon to avoid stockouts.</p>
        </div>
      </div>
    `
  })
}

const getTemplate = (templateName, data) => {
  const template = templates[templateName]
  if (!template) {
    return {
      subject: 'NexCart Notification',
      html: `<p>${JSON.stringify(data)}</p>`
    }
  }
  return template(data)
}

module.exports = { getTemplate }